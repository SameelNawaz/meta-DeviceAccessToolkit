// Minimal localhost ingestion server for Meta Wearables DAT proof-of-concept
// Uses Node.js standard library only (no external dependencies).
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const STATIC_DIR = path.join(__dirname, 'public');
const MAX_LOG_SIZE = 100;

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const METADATA_FILE = path.join(UPLOAD_DIR, 'metadata.json');

function loadCaptureLog() {
  try {
    if (fs.existsSync(METADATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
      if (Array.isArray(data)) return data.slice(0, MAX_LOG_SIZE);
    }
  } catch {
    // Ignore invalid metadata and start clean
  }
  return [];
}

const captureLog = loadCaptureLog();

function persistCaptureLog() {
  try {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(captureLog, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist metadata:', err.message);
  }
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(data));
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === getLanIp();
  } catch {
    return false;
  }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    req.on('data', chunk => {
      bytes += chunk.length;
      // Guard against memory exhaustion (10MB byte limit)
      if (bytes > 10 * 1024 * 1024) {
        req.destroy();
        return reject(new Error('Payload exceeds 10MB limit'));
      }
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function hasValidHeader(type, buffer) {
  if (type === 'photo') {
    return buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8;
  }
  if (type === 'voice') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WAVE'
    );
  }
  return false;
}

// Unified media capture processor
async function handleMediaCapture(req, res, type, extension, extraFields = () => ({})) {
  try {
    const data = await parseJsonBody(req);
    if (!data.dataBase64 || typeof data.dataBase64 !== 'string') {
      return sendJson(res, 400, { error: 'Missing dataBase64 payload' });
    }

    const buffer = Buffer.from(data.dataBase64, 'base64');
    if (!hasValidHeader(type, buffer)) {
      return sendJson(res, 400, { error: `Invalid ${type} file header` });
    }

    const captureId = `${type}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const filename = `${captureId}.${extension}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    fs.writeFileSync(filePath, buffer);

    const record = {
      id: captureId,
      type,
      mode: data.mode === 'PHYSICAL' ? 'PHYSICAL' : 'MOCK',
      filename,
      sizeBytes: buffer.length,
      deviceModel: String(data.deviceModel || 'Ray-Ban Meta').slice(0, 64),
      timestamp: new Date().toISOString(),
      ...extraFields(data)
    };

    captureLog.unshift(record);
    while (captureLog.length > MAX_LOG_SIZE) {
      const evicted = captureLog.pop();
      if (evicted && evicted.filename) {
        try {
          fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(evicted.filename)));
        } catch {
          // Ignore missing file on disk
        }
      }
    }
    persistCaptureLog();

    return sendJson(res, 200, { success: true, capture: record });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}

function getLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const [name, list] of Object.entries(interfaces)) {
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
        if (/wi-?fi|wlan|wireless|ethernet|en0|eth0/i.test(name)) return iface.address;
        candidates.push(iface.address);
      }
    }
  }
  return candidates[0] || 'localhost';
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.wav': 'audio/wav'
};

function serveFile(res, baseDir, relPath) {
  const root = path.resolve(baseDir);
  const fullPath = path.resolve(root, relPath);
  if (fullPath.startsWith(root + path.sep) && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff'
    });
    fs.createReadStream(fullPath).pipe(res);
    return true;
  }
  return false;
}

const server = http.createServer((req, res) => {
  if (!isAllowedOrigin(req)) {
    return sendJson(res, 403, { error: 'Forbidden origin' });
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // API Routes
  if (req.method === 'POST') {
    if (url.pathname === '/api/capture/photo') {
      return handleMediaCapture(req, res, 'photo', 'jpg');
    }
    if (url.pathname === '/api/capture/voice') {
      return handleMediaCapture(req, res, 'voice', 'wav', d => ({
        durationSeconds: Math.min(Math.max(Number(d.durationSeconds) || 2, 0.1), 30)
      }));
    }
  }

  if (req.method === 'GET') {
    if (url.pathname === '/api/network-info') {
      const ip = getLanIp();
      return sendJson(res, 200, { ip, port: PORT, mobileUrl: `http://${ip}:${PORT}` });
    }
    if (url.pathname === '/api/captures') {
      return sendJson(res, 200, { captures: captureLog });
    }

    if (url.pathname.startsWith('/uploads/')) {
      if (serveFile(res, UPLOAD_DIR, url.pathname.replace(/^\/uploads\//, ''))) return;
    }

    const relPath = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    if (serveFile(res, STATIC_DIR, relPath)) return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Meta DAT Localhost Endpoint running at http://localhost:${PORT}`);
  });
}

module.exports = { server, captureLog, loadCaptureLog, UPLOAD_DIR, METADATA_FILE };
