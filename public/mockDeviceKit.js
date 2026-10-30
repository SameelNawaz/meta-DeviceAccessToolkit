// Meta Wearables Device Access Toolkit (DAT) - Mock Device Kit implementation
// Follows Meta DAT's MockDeviceKit API specification.

const GlassesModel = {
  RAYBAN_META: 'Ray-Ban Meta',
  RAYBAN_DISPLAY: 'Ray-Ban Display',
  OAKLEY_META: 'Oakley Meta'
};

const WearableMode = {
  MOCK: 'MOCK',
  PHYSICAL: 'PHYSICAL'
};

function arrayBufferToBase64(buffer) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  const bytes = new Uint8Array(buffer);
  const chunks = [];
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize)));
  }
  return btoa(chunks.join(''));
}

class MockCameraCaptureKit {
  constructor(glasses) {
    this.glasses = glasses;
    this.photoFixtureBase64 = null;
    this.failNextCapture = false;
  }

  // shortcut: Uses a hardcoded 1x1 JPEG fixture when no custom URI is provided; provide camera feed injection for advanced computer vision.
  setCapturedPhoto(base64Data) {
    this.photoFixtureBase64 = base64Data;
  }

  simulateCaptureFailure() {
    this.failNextCapture = true;
  }

  async capturePhoto() {
    if (this.failNextCapture) {
      this.failNextCapture = false;
      throw new Error('Simulated hardware capture failure');
    }

    if (!this.glasses.isPoweredOn) {
      throw new Error('Glasses are powered off');
    }
    if (!this.glasses.isUnfolded) {
      throw new Error('Glasses are folded');
    }
    if (!this.glasses.isDonned) {
      throw new Error('Glasses are not donned (wearer is not wearing them)');
    }

    // Default valid minimal JPEG test fixture (valid 1x1 JPEG)
    const defaultJpeg =
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

    return {
      mimeType: 'image/jpeg',
      dataBase64: this.photoFixtureBase64 || defaultJpeg,
      timestamp: new Date().toISOString()
    };
  }
}

class MockAudioKit {
  constructor(glasses) {
    this.glasses = glasses;
  }

  // Generates valid 16kHz mono PCM WAV voice note buffer
  // shortcut: Synthesizes a mono 440Hz test voice waveform; route to live Web Audio API microphone when hardware streaming is required.
  async recordVoiceNote(durationSeconds = 2) {
    if (!this.glasses.isPoweredOn) {
      throw new Error('Glasses are powered off');
    }
    if (!this.glasses.isDonned) {
      throw new Error('Glasses are not donned (wearer is not wearing them)');
    }

    // Guard duration between 0.1s and 30s to prevent heap exhaustion
    const safeDuration = Math.min(Math.max(Number(durationSeconds) || 2, 0.1), 30);
    const sampleRate = 16000;
    const numSamples = Math.floor(sampleRate * safeDuration);
    const dataSize = numSamples * 2; // 16-bit = 2 bytes per sample
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // Write RIFF WAV Header
    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM Chunk size
    view.setUint16(20, 1, true); // Audio format 1 = PCM
    view.setUint16(22, 1, true); // 1 channel (mono voice per Meta DAT HFP spec)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // 16-bit
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Synthesize simple voice note waveform
    const freq = 440; // A4 voice test pitch
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const sample = Math.sin(2 * Math.PI * freq * t) * 0.5 * 32767;
      view.setInt16(44 + i * 2, sample, true);
    }

    let dataBase64;
    if (typeof Blob !== 'undefined' && typeof FileReader !== 'undefined') {
      dataBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result || '';
          resolve(res.slice(res.indexOf(',') + 1));
        };
        reader.onerror = reject;
        reader.readAsDataURL(new Blob([buffer], { type: 'audio/wav' }));
      });
    } else {
      dataBase64 = arrayBufferToBase64(buffer);
    }

    return {
      mimeType: 'audio/wav',
      durationSeconds: safeDuration,
      dataBase64,
      timestamp: new Date().toISOString()
    };
  }
}

class SimulatedGlasses {
  constructor(model = GlassesModel.RAYBAN_META) {
    this.model = model;
    this.isPoweredOn = false;
    this.isUnfolded = false;
    this.isDonned = false;

    this.services = {
      cameraCapture: new MockCameraCaptureKit(this),
      audio: new MockAudioKit(this)
    };
  }

  powerOn() {
    this.isPoweredOn = true;
  }

  powerOff() {
    this.isPoweredOn = false;
    this.isDonned = false;
  }

  unfold() {
    this.isUnfolded = true;
  }

  fold() {
    this.isUnfolded = false;
    this.isDonned = false;
  }

  don() {
    if (!this.isPoweredOn) throw new Error('Cannot don powered-off glasses');
    if (!this.isUnfolded) throw new Error('Cannot don folded glasses');
    this.isDonned = true;
  }

  doff() {
    this.isDonned = false;
  }

  getState() {
    return {
      model: this.model,
      isPoweredOn: this.isPoweredOn,
      isUnfolded: this.isUnfolded,
      isDonned: this.isDonned
    };
  }
}

class MockDeviceKit {
  static _instance = null;

  constructor() {
    this.enabled = false;
    this.pairedGlasses = null;
  }

  static getInstance() {
    if (!MockDeviceKit._instance) {
      MockDeviceKit._instance = new MockDeviceKit();
    }
    return MockDeviceKit._instance;
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
    this.pairedGlasses = null;
  }

  pairGlasses(model = GlassesModel.RAYBAN_META) {
    if (!this.enabled) {
      throw new Error('MockDeviceKit must be enabled before pairing glasses');
    }
    this.pairedGlasses = new SimulatedGlasses(model);
    return {
      getOrThrow: () => this.pairedGlasses
    };
  }
}

class WearableDeviceProvider {
  constructor() {
    this.mode = WearableMode.MOCK;
    this.mockKit = MockDeviceKit.getInstance();
    this.mockKit.enable();
    this.simulatedGlasses = this.mockKit.pairGlasses(GlassesModel.RAYBAN_META).getOrThrow();
  }

  setMode(mode) {
    if (mode !== WearableMode.MOCK && mode !== WearableMode.PHYSICAL) {
      throw new Error(`Invalid mode: ${mode}`);
    }
    this.mode = mode;
  }

  async capturePhoto() {
    if (this.mode === WearableMode.MOCK) {
      const res = await this.simulatedGlasses.services.cameraCapture.capturePhoto();
      return { ...res, source: 'MockDeviceKit' };
    }
    // Physical hardware execution path via native bridge or companion app
    if (typeof window !== 'undefined' && window.MetaWearableNative) {
      return await window.MetaWearableNative.capturePhoto();
    }
    // shortcut: In standalone browsers without native container, physical glasses cannot pair over raw Web Bluetooth without the companion app.
    throw new Error('Physical glasses mode requires running inside the Android/iOS native container paired to Meta View.');
  }

  async recordVoiceNote(durationSeconds = 2) {
    if (this.mode === WearableMode.MOCK) {
      const res = await this.simulatedGlasses.services.audio.recordVoiceNote(durationSeconds);
      return { ...res, source: 'MockDeviceKit' };
    }
    if (typeof window !== 'undefined' && window.MetaWearableNative) {
      return await window.MetaWearableNative.recordVoiceNote(durationSeconds);
    }
    throw new Error('Physical glasses mode requires running inside the Android/iOS native container paired to Meta View.');
  }

  getStatus() {
    return {
      mode: this.mode,
      isMock: this.mode === WearableMode.MOCK,
      deviceState: this.simulatedGlasses.getState(),
      statusText: this.mode === WearableMode.MOCK ? 'Simulated (MockDeviceKit)' : 'Physical Hardware (Meta View)'
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MockDeviceKit, GlassesModel, SimulatedGlasses, WearableMode, WearableDeviceProvider };
} else if (typeof window !== 'undefined') {
  window.MockDeviceKit = MockDeviceKit;
  window.GlassesModel = GlassesModel;
  window.WearableMode = WearableMode;
  window.WearableDeviceProvider = WearableDeviceProvider;
}
