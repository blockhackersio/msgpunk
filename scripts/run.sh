#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  kill %1 2>/dev/null || true
}
trap cleanup EXIT

cargo run &

cloudflared tunnel --url http://localhost:8080
