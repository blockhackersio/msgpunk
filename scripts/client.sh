#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export WEBKIT_DISABLE_COMPOSITING_MODE=1
export WEBKIT_DISABLE_DMABUF_RENDERER=1
export WEBKIT_DISABLE_GPU_PROCESS=1
export LIBGL_ALWAYS_SOFTWARE=1
export GSK_RENDERER=cairo

cd "$SCRIPT_DIR/../client" && exec devenv shell cargo tauri dev

