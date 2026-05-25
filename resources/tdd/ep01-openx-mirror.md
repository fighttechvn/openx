# EP01 OpenX Mirror TDD

## Test Strategy

OpenX Mirror is split into testable layers:

- Agent security helpers: unit tests with `node:test`.
- Agent HTTP API: integration tests can be added with temporary stores and random ports.
- Dashboard behavior: manual browser acceptance tests for the static UI.

## Unit Tests

### Security Path Handling

Given an existing folder, `normalizeAllowedFolder` returns its canonical path.

Given a relative request that escapes the root, `resolveInside` throws an error.

Given a file extension, `isStaticFile` accepts report-safe files and rejects unknown file types.

Current test file:

```text
agent/security.test.js
```

Run:

```bash
npm test
```

## API Acceptance Tests

### Pairing

1. Start agent with a temporary store.
2. Read pairing code from terminal or `GET /pairing-code`.
3. Call `POST /pair` with invalid code.
4. Expect `401`.
5. Call `POST /pair` with valid code.
6. Expect `200` and `accessToken`.
7. Reuse same code.
8. Expect `401`.

### Folder Allowlist

1. Pair dashboard with agent.
2. Call `POST /folders` without token.
3. Expect `401`.
4. Call `POST /folders` with token and invalid path.
5. Expect `400`.
6. Call `POST /folders` with token and valid directory.
7. Expect stored canonical folder path.

### Scan

1. Create temp folder with `e2e.html`, `srs.html`, `notes.md`, and `secret.env`.
2. Add folder to agent.
3. Call `GET /scan/:folderId`.
4. Expect static files only.
5. Expect `secret.env` absent.

### File Type Filters

1. Open dashboard with no stored filter config.
2. Expect `.html` and `.md` tags to be active.
3. Scan a folder containing `.html`, `.md`, and `.pdf`.
4. Expect `.html` and `.md` files visible by default.
5. Toggle `.md` off.
6. Expect Markdown files hidden.
7. Open the three-dot filter dialog.
8. Add `.pdf`, save, and expect `.pdf` tag visible.
9. Edit `.pdf` to `.txt`, save, and expect `.txt` tag visible.
10. Delete `.txt`, save, and expect `.txt` tag removed.

### File Serve

1. Request an allowed file path.
2. Expect `200` and correct content type.
3. Request `../secret.html`.
4. Expect rejection.
5. Request a disallowed extension.
6. Expect `403`.

### LAN Discovery

1. Start a paired local agent.
2. Call `GET /lan/scan` without token.
3. Expect `401`.
4. Call `GET /lan/scan?subnet=127.0.0&port=8787` with token.
5. Expect response shape with `subnet`, `port`, and `devices`.
6. Start a second agent on the same port from another LAN machine.
7. Scan again and expect that machine in `devices`.

### Cloud Sync

1. Run `supabase/schema.sql` in Supabase SQL Editor.
2. Open dashboard and configure Supabase URL, anon key, workspace slug, and sync key.
3. Add at least one machine, folder, and file type filter.
4. Click `Push`.
5. Open dashboard in another browser profile or device.
6. Enter the same cloud settings.
7. Click `Pull`.
8. Expect machines, folders, and file type filters to appear.
9. Confirm agent tokens are not present until the second browser pairs locally.
10. Pull again after local pairing and confirm matching local tokens are preserved.

## Dashboard Manual Tests

### Machine CRUD

1. Open `dashboard/index.html`.
2. Add machine with name, host, and port.
3. Confirm it appears in sidebar.
4. Select it and verify header details.
5. Delete it and confirm sidebar updates.

### Pairing

1. Start agent.
2. Copy pairing code.
3. Add machine in dashboard.
4. Click Pair and submit code.
5. Confirm machine status changes to `Paired`.

### Folder CRUD And Scan

1. Add a valid absolute folder path.
2. Confirm folder appears.
3. Scan folder.
4. Confirm static files appear.
5. Search for `e2e`.
6. Click the `e2e.html` result item.
7. Confirm `e2e.html` opens in a new tab.

### LAN Scan

1. Pair at least one local agent.
2. Click `Scan LAN`.
3. Confirm discovered OpenX agents appear in `LAN Devices`.
4. Click `Add` on a discovered device.
5. Confirm it appears in the machine sidebar as not paired.

## Done Criteria

- Static dashboard can manage multiple machines.
- Agent can pair with a dashboard using a short verification code.
- Agent can add, edit, delete, scan, and serve allowed folders.
- Path traversal unit test passes.
- Documentation covers product, design, and test plan.
