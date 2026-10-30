# Meta Wearables Device Access Toolkit (DAT) - AGENTS.md

This repository implements a proof of concept (POC) for the Meta Wearables Device Access Toolkit (DAT).
It enables capturing photos and voice notes from smart glasses (e.g. Ray-Ban Meta) and transmitting them through a mobile application to a localhost backend endpoint.

## Architecture

- **Wearables DAT & Mock Device Kit:**
  - Production builds connect to Meta AI smart glasses via the Meta Wearables DAT SDK (`com.meta.wearable.dat:mwdat-core`, `mwdat-camera`).
  - Development / testing runs via `MockDeviceKit` (`mwdat-mockdevice` / `MWDATMockDevice`), allowing hardware simulation (pairing, power, folding, donning, camera capture fixtures, and audio frames) without physical glasses.
- **Cross-Platform Mobile Client:**
  - Handles device lifecycle, user triggers for photo capture and voice note recording, and payload dispatch.
- **Localhost Ingestion Endpoint:**
  - Receives `POST /api/capture/photo` and `POST /api/capture/voice`, validates payloads, and persists media artifacts to `./uploads/`.

## Meta Wearables MCP Integration

This project uses the official Meta Wearables MCP Server for documentation and API searches:
- **Server URL:** `https://mcp.developer.meta.com/wearables`
- **Transport:** HTTP / Streamable HTTP
- **Available Tools:**
  - `search_dat_docs`: Query DAT SDK guides, camera capture, and MockDeviceKit APIs.
  - `search_webapps_docs`: Query Wearables WebApps documentation.

## Running the POC

1. Start the localhost server:
   ```bash
   node server.js
   ```
2. Run automated verification:
   ```bash
   node test.js
   ```
3. Open mobile app in browser or mobile emulator:
   Navigate to `http://localhost:3000`
