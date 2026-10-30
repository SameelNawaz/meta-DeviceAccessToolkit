# Meta Wearables Device Access Toolkit (DAT) - Proof of Concept

This repository implements a lightweight, cross-platform proof of concept (POC) for Meta Wearables Device Access Toolkit (DAT). It demonstrates capturing photos and voice notes on simulated Ray-Ban Meta glasses and streaming them through a mobile application interface to a localhost backend endpoint.

## Project Structure

```
├── AGENTS.md                  # Standard AI coding assistant instructions for Meta DAT
├── .mcp.json                  # Wearables MCP server integration (https://mcp.developer.meta.com/wearables)
├── server.js                  # Localhost ingestion endpoint (zero external dependencies)
├── test.js                    # Automated end-to-end verification suite
├── package.json               # Scripts and metadata
├── public/
│   ├── index.html             # Cross-platform mobile gateway interface
│   ├── app.js                 # Mobile client controller & transmission dispatcher
│   ├── style.css              # Responsive mobile UI styling
│   └── mockDeviceKit.js       # Meta DAT MockDeviceKit simulation suite
└── android/
    ├── MetaWearableBridge.kt  # Native Android bridge for mwdat-mockdevice
    └── build.gradle.kts       # Gradle configuration for Meta Wearables DAT SDK
```

## Quick Start

### 1. Install & Run Localhost Server
```bash
npm start
```
The server starts at `http://localhost:3000`.

### 2. Open Mobile Gateway App
Navigate to `http://localhost:3000` on your desktop browser, mobile browser, or emulator.

- **Toggle Device State**: Power On/Off, Unfold/Fold, Don/Doff.
- **Capture Photo**: Triggers `MockCameraCaptureKit` and sends payload to `POST /api/capture/photo`.
- **Record Voice Note**: Triggers `MockAudioKit` (16kHz mono WAV) and sends payload to `POST /api/capture/voice`.
- **Saved Media**: Photos and voice notes are stored on the server under `./uploads/`.

### 3. Run Automated Tests
```bash
npm test
```
Validates device state lifecycle, photo capture, voice recording, HTTP transmission, JPEG/WAV magic byte verification, and error handling.

## Meta DAT AI-Assisted Setup

- **`AGENTS.md`**: Provides full context on DAT architecture and Mock Device Kit conventions for coding agents.
- **Wearables MCP**: Points to `https://mcp.developer.meta.com/wearables` providing live documentation lookup via `search_dat_docs` and `search_webapps_docs`.
