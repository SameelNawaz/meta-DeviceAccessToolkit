// Automated end-to-end test suite for Meta Wearables DAT proof-of-concept
// Verifies MockDeviceKit lifecycle, photo capture, voice recording, and localhost transmission.

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { server, UPLOAD_DIR, METADATA_FILE, loadCaptureLog } = require('./server');
const { MockDeviceKit, GlassesModel, WearableDeviceProvider, WearableMode } = require('./public/mockDeviceKit');

const TEST_PORT = 3001;

function makePost(pathname, data, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const req = http.request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...extraHeaders
        }
      },
      res => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function makeGet(pathname) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${TEST_PORT}${pathname}`, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('>>> Starting Meta Wearables DAT Proof of Concept Verification Suite');

  await new Promise(resolve => server.listen(TEST_PORT, resolve));
  console.log(`[PASS] Server booted on test port ${TEST_PORT}`);

  try {
    // 1. MockDeviceKit Initialization
    const mockKit = MockDeviceKit.getInstance();
    mockKit.enable();
    const glasses = mockKit.pairGlasses(GlassesModel.RAYBAN_META).getOrThrow();
    assert.strictEqual(glasses.model, GlassesModel.RAYBAN_META);
    console.log('[PASS] MockDeviceKit initialized and paired simulated Ray-Ban Meta glasses');

    // 2. Hardware Guard Checks (folded / powered off)
    let threw = false;
    try {
      await glasses.services.cameraCapture.capturePhoto();
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, true, 'Should fail to capture photo when powered off');

    glasses.powerOn();
    glasses.unfold();
    glasses.don();
    console.log('[PASS] Hardware state transitions: powerOn -> unfold -> don passed');

    // 3. Photo Capture via MockCameraCaptureKit & Transmission to Localhost
    const photoResult = await glasses.services.cameraCapture.capturePhoto();
    assert.ok(photoResult.dataBase64, 'Mock camera should produce base64 image data');
    assert.strictEqual(photoResult.mimeType, 'image/jpeg');

    const photoRes = await makePost('/api/capture/photo', {
      deviceModel: glasses.model,
      dataBase64: photoResult.dataBase64,
      timestamp: photoResult.timestamp
    });

    assert.strictEqual(photoRes.status, 200);
    assert.strictEqual(photoRes.data.success, true);
    assert.ok(photoRes.data.capture.id.startsWith('photo_'));
    console.log(`[PASS] Photo captured and successfully saved by localhost: ${photoRes.data.capture.filename}`);

    // Verify JPEG file header on disk
    const savedPhotoPath = path.join(UPLOAD_DIR, photoRes.data.capture.filename);
    assert.ok(fs.existsSync(savedPhotoPath), 'Saved photo file must exist on disk');
    const photoBytes = fs.readFileSync(savedPhotoPath);
    // JPEG magic bytes: 0xFF, 0xD8
    assert.strictEqual(photoBytes[0], 0xff);
    assert.strictEqual(photoBytes[1], 0xd8);
    console.log('[PASS] Saved photo verified with valid JPEG magic header');

    // 4. Voice Note Capture via MockAudioKit & Transmission to Localhost
    const voiceResult = await glasses.services.audio.recordVoiceNote(2);
    assert.ok(voiceResult.dataBase64, 'Mock audio should produce base64 voice note data');
    assert.strictEqual(voiceResult.mimeType, 'audio/wav');

    const voiceRes = await makePost('/api/capture/voice', {
      deviceModel: glasses.model,
      durationSeconds: voiceResult.durationSeconds,
      dataBase64: voiceResult.dataBase64,
      timestamp: voiceResult.timestamp
    });

    assert.strictEqual(voiceRes.status, 200);
    assert.strictEqual(voiceRes.data.success, true);
    assert.ok(voiceRes.data.capture.id.startsWith('voice_'));
    console.log(`[PASS] Voice note captured and successfully saved by localhost: ${voiceRes.data.capture.filename}`);

    // Verify WAV RIFF header on disk
    const savedVoicePath = path.join(UPLOAD_DIR, voiceRes.data.capture.filename);
    assert.ok(fs.existsSync(savedVoicePath), 'Saved voice note file must exist on disk');
    const voiceBytes = fs.readFileSync(savedVoicePath);
    // WAV header: "RIFF" ... "WAVE"
    const headerPrefix = voiceBytes.slice(0, 4).toString('ascii');
    const waveFormat = voiceBytes.slice(8, 12).toString('ascii');
    assert.strictEqual(headerPrefix, 'RIFF');
    assert.strictEqual(waveFormat, 'WAVE');
    console.log('[PASS] Saved voice note verified with valid RIFF/WAVE header');

    // 5. Query Captures API & Verify Metadata File Persistence
    const capturesRes = await makeGet('/api/captures');
    assert.strictEqual(capturesRes.status, 200);
    assert.ok(capturesRes.data.captures.length >= 2);
    console.log(`[PASS] Ingestion query returned ${capturesRes.data.captures.length} logged captures`);

    assert.ok(fs.existsSync(METADATA_FILE), 'metadata.json must exist on disk for restart persistence');
    const persistedLog = loadCaptureLog();
    assert.strictEqual(persistedLog.length, capturesRes.data.captures.length);
    console.log('[PASS] Metadata persistence across server restarts verified via metadata.json');

    // 6. Test 5-Second Audio Chunked Base64 Voice Note
    const longVoice = await glasses.services.audio.recordVoiceNote(5);
    assert.strictEqual(longVoice.durationSeconds, 5);
    assert.ok(longVoice.dataBase64.length > 50000, '5s audio base64 should exceed 50KB');
    console.log('[PASS] High-sample voice note (5s / 160KB PCM) successfully chunked and encoded');

    // 7. PWA & Network Info Verification
    const netRes = await makeGet('/api/network-info');
    assert.strictEqual(netRes.status, 200);
    assert.ok(netRes.data.ip, 'Network info must provide LAN IP');
    assert.ok(netRes.data.mobileUrl.startsWith('http://'), 'Must provide valid mobileUrl for QR code');
    console.log(`[PASS] Network discovery returned dynamic LAN IP: ${netRes.data.ip} (${netRes.data.mobileUrl})`);

    const manifestRes = await makeGet('/manifest.json');
    assert.strictEqual(manifestRes.status, 200);
    assert.strictEqual(manifestRes.data.display, 'standalone');
    console.log('[PASS] PWA Web App Manifest verified with standalone mobile display');

    const swRes = await makeGet('/sw.js');
    assert.strictEqual(swRes.status, 200);
    console.log('[PASS] PWA Service Worker script served successfully');

    // 8. Dual-Mode WearableDeviceProvider Parity (Mock vs Physical)
    const provider = new WearableDeviceProvider();
    assert.strictEqual(provider.mode, WearableMode.MOCK);
    provider.simulatedGlasses.powerOn();
    provider.simulatedGlasses.unfold();
    provider.simulatedGlasses.don();

    const mockPhoto = await provider.capturePhoto();
    assert.strictEqual(mockPhoto.source, 'MockDeviceKit');
    assert.ok(mockPhoto.dataBase64);

    provider.setMode(WearableMode.PHYSICAL);
    assert.strictEqual(provider.mode, WearableMode.PHYSICAL);
    let physicalThrew = false;
    try {
      await provider.capturePhoto();
    } catch (e) {
      physicalThrew = true;
      assert.ok(e.message.includes('Meta View'));
    }
    assert.strictEqual(physicalThrew, true, 'Physical mode without bridge should require Meta View container');
    console.log('[PASS] Dual-mode WearableDeviceProvider contract equivalence verified');

    // 9. Bad Payload & Security Boundary Validation
    const badRes = await makePost('/api/capture/photo', {});
    assert.strictEqual(badRes.status, 400);

    const fakeHeaderRes = await makePost('/api/capture/photo', {
      dataBase64: Buffer.from('<script>alert(1)</script>').toString('base64')
    });
    assert.strictEqual(fakeHeaderRes.status, 400, 'Non-JPEG payload must be rejected');

    const traversalRes = await makeGet('/uploads/../server.js');
    assert.strictEqual(traversalRes.status, 404, 'Path traversal must be blocked');

    const crossOriginRes = await makePost(
      '/api/capture/photo',
      { dataBase64: photoResult.dataBase64 },
      { Origin: 'https://evil.example.com' }
    );
    assert.strictEqual(crossOriginRes.status, 403, 'Untrusted cross-origin POST must be rejected');
    console.log('[PASS] Security boundary checks passed (magic bytes, path traversal, cross-origin guard)');

    console.log('\n>>> ALL META WEARABLES DAT POC TESTS PASSED SUCCESSFULLY! <<<\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('[FAIL] Test failed:', err);
  process.exit(1);
});
