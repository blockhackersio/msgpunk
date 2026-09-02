#!/usr/bin/env bash
set -euo pipefail

PID_FILE="/tmp/cfup/pid"

if [ ! -f "$PID_FILE" ]; then
  echo "No running tunnel found (no PID file)" >&2
  exit 1
fi

CF_PID=$(cat "$PID_FILE")

if kill "$CF_PID" 2>/dev/null; then
  echo "Tunnel (PID $CF_PID) stopped" >&2
else
  echo "Tunnel process not running" >&2
fi

rm -f "$PID_FILE" /tmp/cfup/local_url
rmdir /tmp/cfup 2>/dev/null || true
