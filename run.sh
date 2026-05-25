#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_PORT="${DASHBOARD_PORT:-8080}"
AGENT_HOST="${AGENT_HOST:-127.0.0.1}"
AGENT_PORT="${AGENT_PORT:-8787}"
AGENT_STORE="${AGENT_STORE:-$ROOT_DIR/.openx-mirror-agent.local.json}"

DASHBOARD_PID=""
AGENT_PID=""

cleanup() {
  echo
  echo "Stopping OpenX Mirror..."
  if [[ -n "$DASHBOARD_PID" ]] && kill -0 "$DASHBOARD_PID" 2>/dev/null; then
    kill "$DASHBOARD_PID" 2>/dev/null || true
  fi
  if [[ -n "$AGENT_PID" ]] && kill -0 "$AGENT_PID" 2>/dev/null; then
    kill "$AGENT_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command node
require_command python3

echo "Starting OpenX Mirror"
echo "Dashboard: http://localhost:$DASHBOARD_PORT"
echo "Agent:     http://$AGENT_HOST:$AGENT_PORT"
echo

(
  cd "$ROOT_DIR/dashboard"
  python3 -m http.server "$DASHBOARD_PORT"
) &
DASHBOARD_PID="$!"

(
  cd "$ROOT_DIR"
  node agent/server.js --host "$AGENT_HOST" --port "$AGENT_PORT" --store "$AGENT_STORE"
) &
AGENT_PID="$!"

echo
echo "Open the dashboard, add machine:"
echo "  Name: Local Agent"
echo "  Host: $AGENT_HOST"
echo "  Port: $AGENT_PORT"
echo
echo "Use the pairing code printed above by the agent."
echo "Press Ctrl+C to stop."
echo

wait "$DASHBOARD_PID" "$AGENT_PID"
