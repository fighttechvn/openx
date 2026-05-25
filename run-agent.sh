#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_HOST="${AGENT_HOST:-0.0.0.0}"
AGENT_PORT="${AGENT_PORT:-8787}"
AGENT_STORE="${AGENT_STORE:-$ROOT_DIR/.openx-mirror-agent.local.json}"

if ! command -v node >/dev/null 2>&1; then
  echo "Missing required command: node" >&2
  exit 1
fi

echo "Starting OpenX Mirror agent"
echo "Host:  $AGENT_HOST"
echo "Port:  $AGENT_PORT"
echo "Store: $AGENT_STORE"
echo
echo "For LAN access, add this machine in the dashboard using its Wi-Fi/LAN IP and port $AGENT_PORT."
echo "Use the pairing code printed below."
echo "Press Ctrl+C to stop."
echo

cd "$ROOT_DIR"
exec node agent/server.js --host "$AGENT_HOST" --port "$AGENT_PORT" --store "$AGENT_STORE"
