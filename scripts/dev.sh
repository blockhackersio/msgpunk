#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

DEVENV_CMD="devenv shell --"

cleanup() {
  echo "Shutting down..."
  kill "$SERVER_PID" 2>/dev/null || true
  bash "$ROOT_DIR/scripts/cfdown.sh" 2>/dev/null || true
}
trap cleanup EXIT

echo "Starting msgpunk-server..."
$DEVENV_CMD cargo run -p msgpunk-server &
SERVER_PID=$!

sleep 2

echo "Opening cloudflare tunnel..."
CF_URL=$(bash "$ROOT_DIR/scripts/cfup.sh" "http://localhost:8080")
echo "Server public URL: $CF_URL"

echo "Starting Android client with MSGPUNK_SERVER_URL=$CF_URL"
cd "$ROOT_DIR/client"
MSGPUNK_SERVER_URL="$CF_URL" VITE_MSGPUNK_SERVER_URL="$CF_URL" $DEVENV_CMD cargo-tauri android dev --host 127.0.0.1
