#!/usr/bin/env bash
set -euo pipefail

LOCAL_URL="${1:?Usage: cfup.sh <local-url>}"

TMP_LOG=$(mktemp /tmp/cfup.XXXXXX.log)
cleanup() { rm -f "$TMP_LOG"; }
trap cleanup EXIT

cloudflared tunnel --url "$LOCAL_URL" > /dev/null 2>"$TMP_LOG" &
CF_PID=$!

for i in $(seq 1 15); do
  URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' "$TMP_LOG" 2>/dev/null || true)
  if [ -n "$URL" ]; then
    echo "$URL"
    # keep running in background; save PID for teardown
    mkdir -p /tmp/cfup
    echo "$CF_PID" > /tmp/cfup/pid
    echo "$LOCAL_URL" > /tmp/cfup/local_url
    exit 0
  fi
  sleep 1
done

echo "Timed out waiting for tunnel URL" >&2
kill "$CF_PID" 2>/dev/null || true
exit 1
