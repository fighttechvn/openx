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

```bash
cd openx-mirror
node agent/server.js --port 8787
```

The agent prints a pairing code. In the dashboard, add a machine with the host, port, and code. After pairing, add allowed folders by absolute path and scan them.

## Scan LAN

After pairing with at least one local agent, click `Scan LAN` in the dashboard. The selected agent scans its local `/24` subnet for other OpenX Mirror agents listening on the same port. Discovered machines can be added to the dashboard, but each one still needs its own pairing code before folder access is allowed.

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
