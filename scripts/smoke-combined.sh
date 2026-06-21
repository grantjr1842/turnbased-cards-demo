#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node "$ROOT_DIR/scripts/smoke-cdp.mjs"
"$ROOT_DIR/scripts/smoke-turn-actions.sh"
