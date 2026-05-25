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

Phase 1 cloud sync adds Supabase as a shared configuration store:

```text
iPad / Browser Dashboard
  localStorage: local tokens, cloud settings
        |
        | Supabase REST RPC
        v
Supabase openx_cloud_workspaces
  config JSON: machines, folders, file types
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

### Dashboard File Type Filter

```json
{
  "extension": ".html",
  "enabled": true
}
```

### Cloud Workspace

```json
{
  "slug": "openx-home",
  "name": "Home Lab",
  "config": {
    "version": 1,
    "machines": [],
    "fileTypes": []
  }
}
```

### Cloud API Key

```json
{
  "id": "uuid",
  "workspaceId": "uuid",
  "name": "iPad Safari",
  "prefix": "ox_live_abcd...",
  "createdAt": "2026-05-25T00:00:00Z",
  "lastUsedAt": null,
  "revokedAt": null
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
GET /lan/scan
POST /revoke
```

### Supabase RPC

```text
POST /rest/v1/rpc/openx_pull_config
POST /rest/v1/rpc/openx_push_config
POST /rest/v1/rpc/openx_create_api_key
POST /rest/v1/rpc/openx_list_api_keys
POST /rest/v1/rpc/openx_revoke_api_key
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
4. Dashboard filters entries by enabled file type tags.
5. Dashboard builds file links pointing to `GET /file/:folderId/*relativePath`.
6. User can click either the link or the entire result item to open the file.
7. Agent resolves the relative path inside the allowed root before streaming.

## File Type Filter Flow

1. Dashboard loads `fileTypes` from `localStorage`.
2. If no filter configuration exists, defaults are `.html` and `.md`.
3. User toggles tags to filter visible scan results.
4. User clicks the three-dot button to open the filter editor.
5. User can add, edit, delete, and enable or disable extensions.
6. Dashboard normalizes extensions to lowercase dot-prefixed values.
7. Dashboard keeps at least one extension enabled.

## Cloud Sync Flow

1. User runs `supabase/schema.sql` in the Supabase project.
2. User enters Supabase URL, anon key, workspace slug, and sync key in the dashboard.
3. Dashboard calls `openx_push_config` to create or update a cloud workspace.
4. Supabase stores a SHA-256 hash of the sync key and a JSON config object.
5. Another device enters the same cloud settings and calls `openx_pull_config`.
6. Dashboard replaces local machines and file filters with cloud config.
7. Matching local agent tokens are preserved by `agentMachineId` or `host:port`.

Agent bearer tokens are intentionally excluded from cloud config in phase 1.

## Cloud API Key Flow

1. Admin creates a workspace by pushing config with the original sync key.
2. That original sync key acts as the workspace admin key.
3. Admin opens Admin Portal and enters the admin key.
4. Dashboard calls `openx_create_api_key`.
5. Supabase generates an `ox_live_...` API key and stores only its SHA-256 hash plus prefix.
6. Dashboard shows the raw key once.
7. Other devices use the API key as `Sync API Key` for Pull/Push.
8. Admin can list and revoke keys.

## LAN Discovery Flow

1. User selects an already paired local agent.
2. Dashboard calls `GET /lan/scan?port=8787`.
3. Agent infers the local IPv4 `/24` subnet from the request socket or network interfaces.
4. Agent calls `GET /health` on each host in that subnet using bounded concurrency and short timeouts.
5. Agent returns only reachable OpenX Mirror agents.
6. Dashboard renders discovered devices and can add them as machines.
7. Added devices are not trusted until the user pairs them with their own pairing code.

## Security Controls

- Token-based authorization for all folder, scan, file, and revoke endpoints.
- Pairing code TTL: five minutes.
- One-time pairing code rotation after successful pairing.
- Token stored as SHA-256 hash in agent state.
- Folder paths are canonicalized with `fs.realpathSync`.
- File requests use canonical containment checks to prevent path traversal.
- Only static report extensions are served.
- LAN discovery requires an existing paired agent and does not grant access to discovered machines.
- Supabase direct table access is revoked from `anon` and `authenticated`.
- Supabase access uses RPC functions that verify the workspace sync key.
- Supabase API keys are hashed at rest and can be revoked.
- Cloud sync does not store agent bearer tokens in phase 1.

## Limitations

- HTTP traffic is not encrypted. Use a trusted LAN, VPN, reverse proxy, or HTTPS tunnel for stronger protection.
- CORS is open for LAN convenience in the MVP.
- Dashboard tokens live in browser local storage.
- Dashboard file type filters live in browser local storage.
- Agent is a developer tool, not a hardened internet-facing server.
- LAN scan only detects OpenX Mirror agents on the configured port; it is not a full network inventory tool.

## Future Work

- Agent UI tray app.
- QR pairing.
- HTTPS self-signed certificate bootstrap.
- Role-based clients.
- Folder-level token permissions.
- Import and export dashboard configuration.
