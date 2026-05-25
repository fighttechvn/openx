# EP01 OpenX Mirror User Stories

## EP01.US001 Manage Machines

As a LAN dashboard user, I want to add, edit, remove, and select multiple machines so that I can manage static report access for different computers from one place.

### Acceptance Criteria

- User can add a machine with name, host, and port.
- User can select a machine from the sidebar.
- User can delete a machine from the dashboard.
- Dashboard persists machines in browser local storage.
- Each machine clearly shows paired or not paired status.

## EP01.US002 Pair A Machine

As a machine owner, I want the sharing machine to generate a short verification code so that only approved dashboard clients can access shared folder metadata and files.

### Acceptance Criteria

- Agent generates a six-digit pairing code formatted as `123-456`.
- Pairing code expires after five minutes.
- Pairing code is one-time use.
- Dashboard submits host, port, pairing code, and client name.
- Agent returns a long random access token after a valid pairing request.
- Dashboard stores the token locally and uses it as a bearer token.

## EP01.US003 Manage Shared Folders

As a paired dashboard user, I want to add, edit, and remove allowed folders on a machine so that the agent only exposes approved local paths.

### Acceptance Criteria

- Dashboard requires pairing before folder changes.
- User can add a folder with display name, absolute path, and recursive scan setting.
- Agent validates that the path exists and is a directory.
- Agent canonicalizes the stored path with `realpath`.
- User can edit or delete existing folders.

## EP01.US004 Scan Static Files

As a dashboard user, I want to scan a shared folder, filter static files by type, and open files from the result list so that I can quickly view reports like `e2e.html`, `srs.html`, and Markdown notes.

### Acceptance Criteria

- User can scan one allowed folder at a time.
- Agent returns allowed file types only: `.html`, `.htm`, `.pdf`, `.txt`, `.md`.
- Dashboard groups each file by folder and shows relative path.
- User can search scanned results.
- User can click the whole result item to open a file in a new browser tab.
- Dashboard shows file type filter tags, defaulting to `.html` and `.md`.
- User can toggle file type tags to filter visible results.
- User can open a three-dot menu to add, edit, delete, and activate file type filters.

## EP01.US005 Protect Shared Files

As a machine owner, I want the agent to prevent path traversal and unauthorized access so that shared access cannot escape allowed folders.

### Acceptance Criteria

- Every protected API requires `Authorization: Bearer <token>`.
- File serving resolves requested paths against the canonical allowed folder.
- Requests like `../secret.html` are rejected.
- Non-allowed file types are rejected.
- Clients can revoke their own token.

## EP01.US006 Discover LAN Agents

As a dashboard user, I want to scan the local Wi-Fi/LAN network for OpenX Mirror agents so that I can quickly add machines without typing IP addresses manually.

### Acceptance Criteria

- Dashboard exposes a `Scan LAN` action for a paired machine.
- Agent scans the inferred local subnet for OpenX Mirror agents on the target port.
- Scan result shows host, port, machine name, and latency.
- User can add a discovered agent as a dashboard machine.
- Discovered machines still require pairing before folder management.
- Scan only detects OpenX Mirror agents that expose `/health`; it does not inventory arbitrary Wi-Fi devices.

## EP01.US007 Sync Config To Cloud

As a user with multiple devices, I want to sync OpenX dashboard configuration to Supabase so that iPad and desktop browsers can share the same machine list, folder metadata, and file type filters.

### Acceptance Criteria

- User can configure Supabase URL, anon key, workspace slug, workspace name, and sync key.
- User can push local config to cloud.
- User can pull cloud config from another browser.
- Cloud config includes machines, folders, and file type filters.
- Agent bearer tokens are not uploaded in phase 1.
- Pulling config preserves matching local tokens when they already exist in the browser.
