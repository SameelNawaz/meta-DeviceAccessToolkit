// Cross-platform Mobile Gateway Client
// Coordinates MockDeviceKit hardware simulation and localhost payload dispatch.

(function () {
  const provider = new window.WearableDeviceProvider();
  const glasses = provider.simulatedGlasses;

  // DOM Elements
  const btnModeMock = document.getElementById('btnModeMock');
  const btnModePhysical = document.getElementById('btnModePhysical');
  const kitStatus = document.getElementById('kitStatus');

  const pillPower = document.getElementById('pillPower');
  const pillFold = document.getElementById('pillFold');
  const pillDon = document.getElementById('pillDon');

  const textPower = document.getElementById('textPower');
  const textFold = document.getElementById('textFold');
  const textDon = document.getElementById('textDon');

  const btnTogglePower = document.getElementById('btnTogglePower');
  const btnToggleFold = document.getElementById('btnToggleFold');
  const btnToggleDon = document.getElementById('btnToggleDon');
  const btnResetDevice = document.getElementById('btnResetDevice');

  const btnCapturePhoto = document.getElementById('btnCapturePhoto');
  const btnRecordVoice = document.getElementById('btnRecordVoice');

  const previewArea = document.getElementById('previewArea');
  const mediaContainer = document.getElementById('mediaContainer');
  const previewTime = document.getElementById('previewTime');
  const shutterFlash = document.getElementById('shutterFlash');

  const consoleLogs = document.getElementById('consoleLogs');
  const btnClearLog = document.getElementById('btnClearLog');
  const endpointInput = document.getElementById('endpointInput');
  const capturesList = document.getElementById('capturesList');
  const btnRefreshCaptures = document.getElementById('btnRefreshCaptures');
  const feedCountBadge = document.getElementById('feedCountBadge');
  const btnCopyLink = document.getElementById('btnCopyLink');

  // Auto-bind endpoint to current host (essential when accessing from phone via Wi-Fi IP)
  if (window.location.origin && window.location.origin.startsWith('http')) {
    endpointInput.value = window.location.origin;
  }

  function log(message, type = 'info') {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${time}] ${message}`;
    consoleLogs.appendChild(entry);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
  }

  if (btnClearLog) {
    btnClearLog.addEventListener('click', () => {
      consoleLogs.innerHTML = '';
      log('Telemetry log cleared.', 'info');
    });
  }

  function updateUiState() {
    const state = glasses.getState();

    pillPower.classList.toggle('active', state.isPoweredOn);
    textPower.textContent = state.isPoweredOn ? 'ON' : 'OFF';
    btnTogglePower.textContent = state.isPoweredOn ? 'Power Off' : 'Power On';

    pillFold.classList.toggle('active', state.isUnfolded);
    textFold.textContent = state.isUnfolded ? 'UNFOLDED' : 'FOLDED';
    btnToggleFold.textContent = state.isUnfolded ? 'Fold' : 'Unfold';

    pillDon.classList.toggle('active', state.isDonned);
    textDon.textContent = state.isDonned ? 'DONNED' : 'DOFFED';
    btnToggleDon.textContent = state.isDonned ? 'Doff Glasses' : 'Don Glasses';
  }

  // Unified transmission helper
  async function dispatchToLocalhost(apiPath, payload, typeLabel) {
    const base = endpointInput.value.trim().replace(/\/+$/, '');
    const url = `${base}${apiPath}`;
    log(`Transmitting ${typeLabel} to ${url}...`, 'info');

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const json = await res.json();
    log(`${typeLabel} received & saved! ID: ${json.capture.id} (${json.capture.sizeBytes} bytes)`, 'success');
    fetchRecentCaptures();
    return json;
  }

  function triggerShutterAnimation() {
    if (!shutterFlash) return;
    shutterFlash.classList.add('flashing');
    setTimeout(() => shutterFlash.classList.remove('flashing'), 80);
  }

  function renderMediaPreview(isPhoto, src, timeLabel) {
    previewArea.style.display = 'block';
    if (previewTime) previewTime.textContent = timeLabel;
    mediaContainer.textContent = '';
    if (isPhoto) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = 'Captured Photo';
      mediaContainer.appendChild(img);
    } else {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.autoplay = true;
      audio.src = src;
      mediaContainer.appendChild(audio);
    }
  }

  async function fetchRecentCaptures() {
    try {
      const base = endpointInput.value.trim().replace(/\/+$/, '');
      const res = await fetch(`${base}/api/captures`);
      if (!res.ok) return;
      const data = await res.json();
      if (!capturesList) return;

      const captures = data.captures || [];
      if (feedCountBadge) {
        feedCountBadge.textContent = `${captures.length} saved`;
      }

      capturesList.textContent = '';
      captures.slice(0, 6).forEach(c => {
        const li = document.createElement('li');
        li.className = 'capture-item-card';

        const isPhoto = c.type === 'photo';
        const badgeClass = isPhoto ? 'badge-photo' : 'badge-voice';
        const iconSvg = isPhoto
          ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>'
          : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>';

        const sizeKb = (Number(c.sizeBytes) / 1024 || 0).toFixed(1);
        const timeStr = new Date(c.timestamp).toLocaleTimeString();

        const badgeWrap = document.createElement('div');
        badgeWrap.className = 'capture-badge-wrap';

        const iconBadge = document.createElement('div');
        iconBadge.className = `capture-icon-badge ${badgeClass}`;
        iconBadge.innerHTML = iconSvg;

        const metaCol = document.createElement('div');
        metaCol.className = 'capture-meta-col';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'capture-name';
        nameSpan.textContent = c.filename;

        const subSpan = document.createElement('span');
        subSpan.className = 'capture-sub';
        subSpan.textContent = `${isPhoto ? '12MP JPEG' : 'Spatial PCM'} • ${sizeKb} KB`;

        metaCol.append(nameSpan, subSpan);
        badgeWrap.append(iconBadge, metaCol);

        const timeSpan = document.createElement('span');
        timeSpan.className = 'capture-time';
        timeSpan.textContent = timeStr;

        li.append(badgeWrap, timeSpan);

        li.style.cursor = 'pointer';
        li.title = `Click to inspect ${c.filename}`;
        li.addEventListener('click', () => {
          const safeFile = encodeURIComponent(c.filename);
          renderMediaPreview(isPhoto, `${base}/uploads/${safeFile}`, timeStr);
        });

        capturesList.appendChild(li);
      });
    } catch {
      // Endpoint may be initializing
    }
  }

  if (btnRefreshCaptures) {
    btnRefreshCaptures.addEventListener('click', fetchRecentCaptures);
  }

  // Hardware State Controls
  btnTogglePower.addEventListener('click', () => {
    try {
      if (glasses.isPoweredOn) {
        glasses.powerOff();
        log('Glasses powered off.', 'info');
      } else {
        glasses.powerOn();
        log('Glasses powered on.', 'info');
      }
      updateUiState();
    } catch (e) {
      log(e.message, 'error');
    }
  });

  btnToggleFold.addEventListener('click', () => {
    try {
      if (glasses.isUnfolded) {
        glasses.fold();
        log('Glasses folded.', 'info');
      } else {
        glasses.unfold();
        log('Glasses unfolded.', 'info');
      }
      updateUiState();
    } catch (e) {
      log(e.message, 'error');
    }
  });

  btnToggleDon.addEventListener('click', () => {
    try {
      if (glasses.isDonned) {
        glasses.doff();
        log('Glasses doffed (taken off).', 'info');
      } else {
        glasses.don();
        log('Glasses donned (worn by user).', 'info');
      }
      updateUiState();
    } catch (e) {
      log(e.message, 'error');
    }
  });

  btnResetDevice.addEventListener('click', () => {
    glasses.powerOff();
    glasses.fold();
    log('Device reset to idle state.', 'info');
    updateUiState();
  });

  // Dual-mode controller (Mock Device Kit vs Physical Hardware)
  function setAppMode(mode) {
    provider.setMode(mode);
    const isMock = mode === window.WearableMode.MOCK;
    if (btnModeMock) btnModeMock.classList.toggle('active', isMock);
    if (btnModePhysical) btnModePhysical.classList.toggle('active', !isMock);

    if (kitStatus) {
      kitStatus.textContent = isMock ? 'Mock Active' : 'Physical Mode';
      kitStatus.style.background = isMock ? 'rgba(6, 182, 212, 0.15)' : 'rgba(245, 158, 11, 0.15)';
      kitStatus.style.color = isMock ? 'var(--accent-cyan)' : 'var(--accent-amber)';
      kitStatus.style.borderColor = isMock ? 'rgba(6, 182, 212, 0.3)' : 'rgba(245, 158, 11, 0.3)';
    }

    if (isMock) {
      log('Active mode: Mock Device Kit (simulation active).', 'info');
    } else {
      log('Active mode: Physical Glasses. (Requires native companion bridge paired to Meta View).', 'warn');
    }
  }

  if (btnModeMock) btnModeMock.addEventListener('click', () => setAppMode(window.WearableMode.MOCK));
  if (btnModePhysical) btnModePhysical.addEventListener('click', () => setAppMode(window.WearableMode.PHYSICAL));

  // Photo Capture
  btnCapturePhoto.addEventListener('click', async () => {
    try {
      const modeName = provider.mode === window.WearableMode.MOCK ? 'MockCameraCaptureKit' : 'Physical Camera';
      log(`Triggering photo capture via ${modeName}...`, 'info');
      triggerShutterAnimation();
      const photoResult = await provider.capturePhoto();

      renderMediaPreview(true, `data:image/jpeg;base64,${photoResult.dataBase64}`, new Date().toLocaleTimeString());

      await dispatchToLocalhost('/api/capture/photo', {
        deviceModel: glasses.model,
        mode: provider.mode,
        dataBase64: photoResult.dataBase64,
        timestamp: photoResult.timestamp
      }, 'Photo');
    } catch (err) {
      log(`Photo capture error: ${err.message}`, 'error');
    }
  });

  // Voice Note Recording
  btnRecordVoice.addEventListener('click', async () => {
    try {
      const modeName = provider.mode === window.WearableMode.MOCK ? 'MockAudioKit' : 'Physical Microphones';
      log(`Recording 2s voice note via ${modeName}...`, 'info');
      const voiceResult = await provider.recordVoiceNote(2);

      renderMediaPreview(false, `data:audio/wav;base64,${voiceResult.dataBase64}`, new Date().toLocaleTimeString());

      await dispatchToLocalhost('/api/capture/voice', {
        deviceModel: glasses.model,
        mode: provider.mode,
        durationSeconds: voiceResult.durationSeconds,
        dataBase64: voiceResult.dataBase64,
        timestamp: voiceResult.timestamp
      }, 'Voice Note');
    } catch (err) {
      log(`Audio capture error: ${err.message}`, 'error');
    }
  });

  // Initial state setup
  glasses.powerOn();
  glasses.unfold();
  glasses.don();
  updateUiState();
  fetchRecentCaptures();
  log('Auto-initialized simulated glasses: Powered ON, Unfolded, Donned.', 'info');

  // PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('Service Worker registration skipped:', err);
      });
    });
  }

  // Desktop QR Code Generator for Instant Mobile Pairing
  async function initDesktopQrCode() {
    const qrContainer = document.getElementById('desktopQrContainer');
    const qrDirectLink = document.getElementById('qrDirectLink');
    if (!qrContainer || typeof window.QRCode === 'undefined') return;

    let targetUrl = window.location.href;
    try {
      const res = await fetch('/api/network-info');
      const info = await res.json();
      if (info.mobileUrl) targetUrl = info.mobileUrl;
    } catch {
      // Fallback to window.location
    }

    qrContainer.innerHTML = '';
    new window.QRCode(qrContainer, {
      text: targetUrl,
      width: 170,
      height: 170,
      colorDark: '#07090e',
      colorLight: '#ffffff',
      correctLevel: window.QRCode.CorrectLevel.M
    });

    if (qrDirectLink) {
      qrDirectLink.href = targetUrl;
      qrDirectLink.textContent = targetUrl;
    }

    if (btnCopyLink) {
      btnCopyLink.addEventListener('click', async () => {
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(targetUrl);
          } else {
            const tempInput = document.createElement('input');
            tempInput.value = targetUrl;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
          }
          log('Gateway URL copied to clipboard.', 'success');
        } catch {
          log(`Copy unsupported; manual link: ${targetUrl}`, 'error');
        }
      });
    }
  }

  initDesktopQrCode();
})();
