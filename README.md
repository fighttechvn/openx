# OpenX Mirror

OpenX Mirror is a small LAN file mirror for static reports. It lets a browser dashboard manage many machines, pair with each machine by a short verification code, and open static local files such as `e2e.html` and `srs.html` from allowed folders.

## Structure

- `dashboard/`: static HTML/CSS/JS dashboard.
- `agent/`: zero-dependency Node.js LAN agent that runs on each machine that shares folders.
- `resources/user-story/`: product user stories.
- `resources/technial-design/`: technical design documents.
- `resources/tdd/`: test-driven development notes and acceptance tests.
- `resources/screens/`: ASCII UI layout documents.

## Run Dashboard

For local development, run both the dashboard and local agent:

```bash
./run.sh
```

Defaults:

```text
Dashboard: http://localhost:8080
Agent:     http://127.0.0.1:8787
```

Override ports when needed:

```bash
DASHBOARD_PORT=8090 AGENT_PORT=8788 ./run.sh
```

To run only the dashboard:

Open `dashboard/index.html` directly in a browser, or serve it on the LAN:

```bash
cd openx-mirror/dashboard
python3 -m http.server 8080
```

Then open:

```text
http://<dashboard-machine-ip>:8080
```

## Run Agent On A Sharing Machine

From a checked-out repo:

```bash
cd openx-mirror
./run-agent.sh
```

From npm after publishing:

```bash
npx openx-mirror agent
```

Or with options:

```bash
npx openx-mirror agent --host 0.0.0.0 --port 8787
```

Local CLI test from this repository:

```bash
node bin/openx.js agent --host 0.0.0.0 --port 8787
```

The agent prints a pairing code. In the dashboard, add a machine with the host, port, and code. After pairing, add allowed folders by absolute path and scan them.

The dashboard also has an `Install Agent` button that opens a copyable command dialog for users.

Defaults:

```text
Host:  0.0.0.0
Port:  8787
Store: .openx-mirror-agent.local.json
```

Override agent settings:

```bash
AGENT_HOST=127.0.0.1 AGENT_PORT=8788 ./run-agent.sh
```

## Scan LAN

After pairing with at least one local agent, click `Scan LAN` in the dashboard. The selected agent scans its local `/24` subnet for other OpenX Mirror agents listening on the same port. Discovered machines can be added to the dashboard, but each one still needs its own pairing code before folder access is allowed.

## Cloud Sync Phase 1

Cloud sync stores dashboard configuration in Supabase so iPad, Mac, and other browsers can share the same machine list, folder metadata, and file type filters.

Run the schema once in Supabase SQL Editor:

```text
supabase/schema.sql
```

Then open the dashboard and fill:

```text
Supabase URL: https://<project-ref>.supabase.co
Anon Key:     Supabase project anon key
Workspace:    openx-home
Sync Key:     at least 12 characters
Name:         optional display name
```

Use `Push` to upload local config and `Pull` on another device to download it.

Phase 1 intentionally does not upload agent bearer tokens. Each browser still pairs with an agent locally before it can manage folders or open files.

## Admin Portal API Keys

The Admin Portal is available at:

```text
https://fighttechvn.github.io/openx/admin/
```

For local development:

```text
http://localhost:8080/admin/
```

It manages cloud sync API keys.

- The first `Sync Key` used to create a workspace is the workspace admin key.
- Use the admin key in `Admin Key` to create/list/revoke API keys.
- Generated API keys are shown once and stored in Supabase as hashes only.
- Use generated API keys as `Sync API Key` on iPad or other devices.
- Revoked API keys can no longer pull or push cloud config.

## Security Model

- Pairing code expires after 5 minutes.
- Pairing code is one-time use.
- Paired clients receive bearer tokens.
- Agent only serves files under explicitly allowed folders.
- Path traversal is blocked by canonical path checks.

This is designed for trusted LANs. Use HTTPS or a VPN before exposing it outside a private network.

## GitHub Pages Deploy

The dashboard can be deployed to GitHub Pages from the `gh-pages` branch:

```bash
./deploy.sh
```

Defaults:

```text
Repository: fighttechvn/openx
Branch:     gh-pages
URL:        https://fighttechvn.github.io/openx/
```

Override target repository:

```bash
REPO_SLUG=fighttechvn/openx ./deploy.sh
```

If `GH_TOKEN` or `GITHUB_TOKEN` is present, the script also attempts to enable GitHub Pages through the GitHub API. Otherwise, enable it once in GitHub:

```text
Settings -> Pages -> Deploy from a branch -> gh-pages / root
```
