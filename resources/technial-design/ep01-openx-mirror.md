# EP01 OpenX Mirror Technical Design

## Overview

OpenX Mirror has two parts:

- Static dashboard: `dashboard/index.html`, `dashboard/styles.css`, `dashboard/app.js`.
- Machine agent: `agent/server.js`, `agent/store.js`, `agent/security.js`.

The dashboard is a pure static web app. It stores machine metadata and access tokens in `localStorage`. Each machine that shares local folders runs the Node.js agent on the LAN.

## Architecture

```text
Browser Dashboard
  localStorage: machines, tokens
        |
        | HTTP LAN
        v
Machine Agent
  ~/.openx-mirror-agent.json
        |
        v
Allowed Local Folders
```

## Entities

### Machine

```json
{
  "id": "dashboard-local-id",
  "name": "Mac Mini Dev",
  "host": "192.168.1.20",
  "port": 8787,
  "token": "bearer-token",
  "folders": []
}
```

### Agent State

```json
{
  "machineId": "uuid",
  "machineName": "hostname",
  "folders": [],
  "clients": []
}
```

### Folder

```json
{
  "id": "uuid",
  "name": "lunar-ios",
  "path": "/Volumes/Fightech/Projects/lunar-ios",
  "recursive": true
}
```

### Client

```json
{
  "id": "uuid",
  "name": "OpenX Dashboard",
  "tokenHash": "sha256-token",
  "pairedAt": "2026-05-25T00:00:00.000Z"
}
```

## API

### Public

```text
GET /health
GET /pairing-code
POST /pair
```

`POST /pair` request:

```json
{
  "clientName": "OpenX Dashboard",
  "code": "123-456"
}
```

Response:

```json
{
  "machineId": "uuid",
  "machineName": "Mac Mini Dev",
  "accessToken": "random-token",
  "expiresAt": null
}
```

### Protected

All protected endpoints require:

```text
Authorization: Bearer <token>
```

Endpoints:

```text
GET /folders
POST /folders
PUT /folders/:id
DELETE /folders/:id
GET /scan/:folderId
GET /file/:folderId/*relativePath
POST /revoke
```

## Pairing Flow

1. Agent starts and creates a random six-digit code.
2. Agent prints the code and expiry time to terminal.
3. User enters host, port, and code in the dashboard.
4. Dashboard calls `POST /pair`.
5. Agent validates code and expiry.
6. Agent stores only `sha256(token)`, never the raw token.
7. Dashboard stores the raw token in `localStorage`.
8. Agent immediately rotates the pairing code after successful pairing.

## File Access Flow

1. Dashboard calls `GET /scan/:folderId`.
2. Agent walks the allowed folder.
3. Agent returns static file entries with relative paths.
4. Dashboard builds file links pointing to `GET /file/:folderId/*relativePath`.
5. Agent resolves the relative path inside the allowed root before streaming.

## Security Controls

- Token-based authorization for all folder, scan, file, and revoke endpoints.
- Pairing code TTL: five minutes.
- One-time pairing code rotation after successful pairing.
- Token stored as SHA-256 hash in agent state.
- Folder paths are canonicalized with `fs.realpathSync`.
- File requests use canonical containment checks to prevent path traversal.
- Only static report extensions are served.

## Limitations

- HTTP traffic is not encrypted. Use a trusted LAN, VPN, reverse proxy, or HTTPS tunnel for stronger protection.
- CORS is open for LAN convenience in the MVP.
- Dashboard tokens live in browser local storage.
- Agent is a developer tool, not a hardened internet-facing server.

## Future Work

- Agent UI tray app.
- QR pairing.
- HTTPS self-signed certificate bootstrap.
- Role-based clients.
- Folder-level token permissions.
- Import and export dashboard configuration.
