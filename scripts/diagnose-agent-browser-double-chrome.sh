#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION="${AGENT_BROWSER_SESSION:-double-chrome-diagnose}"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$ROOT_DIR/.tmp-agent-browser/diagnostics/$RUN_ID"
TARGET_URL="${1:-}"

mkdir -p "$OUT_DIR"

env_snapshot() {
  {
    echo "=== agent-browser version ==="
    agent-browser --version
    echo
    echo "=== agent-browser doctor ==="
    agent-browser doctor || true
    echo
    echo "=== agent-browser env ==="
    env | rg '^AGENT_BROWSER_' || true
    echo
    echo "=== project config ==="
    if [[ -f "$ROOT_DIR/agent-browser.json" ]]; then
      cat "$ROOT_DIR/agent-browser.json"
    else
      echo "(none)"
    fi
    echo
    echo "=== user config ==="
    if [[ -f "$HOME/.agent-browser/config.json" ]]; then
      cat "$HOME/.agent-browser/config.json"
    else
      echo "(none)"
    fi
  } | tee "$OUT_DIR/environment.txt"
}

process_snapshot() {
  local label="$1"
  local snapshot="$OUT_DIR/$label-processes.txt"
  ps -axo pid,ppid,stat,command | rg 'agent-browser|/tmp/agent-browser-chrome-|agent-browser/browsers/chrome-' > "$snapshot" || true
  {
    echo "matching process lines: $(wc -l < "$snapshot" | tr -d ' ')"
    echo "chrome browser roots: $(awk '$0 ~ /\/chrome( |$)/ && $0 !~ /--type=/ && $0 !~ /chrome_crashpad_handler/ { count++ } END { print count + 0 }' "$snapshot")"
    echo "chrome browser root pids: $(awk '$0 ~ /\/chrome( |$)/ && $0 !~ /--type=/ && $0 !~ /chrome_crashpad_handler/ { printf "%s ", $1 } END { print "" }' "$snapshot" | sed 's/[[:space:]]*$//')"
  } > "$OUT_DIR/$label-summary.txt"
}

browser_snapshot() {
  local label="$1"
  agent-browser --session "$SESSION" session list > "$OUT_DIR/$label-sessions.txt" 2>&1 || true
  agent-browser --session "$SESSION" tab list > "$OUT_DIR/$label-tabs.txt" 2>&1 || true
  agent-browser --session "$SESSION" get cdp-url > "$OUT_DIR/$label-cdp-url.txt" 2>&1 || true
  agent-browser --session "$SESSION" console > "$OUT_DIR/$label-console.txt" 2>&1 || true
  agent-browser --session "$SESSION" errors > "$OUT_DIR/$label-errors.txt" 2>&1 || true
}

launch_phase() {
  local label="$1"
  local url="${2:-}"

  agent-browser --session "$SESSION" close --all >/dev/null 2>&1 || true
  process_snapshot "${label}-before"

  if [[ -n "$url" ]] && ! curl --max-time 3 -fsS "$url" >/dev/null 2>&1; then
    {
      echo "Target URL is not reachable right now: $url"
      echo "Start the app first, or pass a live URL, then rerun the target phase."
    } | tee "$OUT_DIR/$label-open.log"
    return 0
  fi

  if [[ -n "$url" ]]; then
    agent-browser --session "$SESSION" --debug --verbose --headed open "$url" > "$OUT_DIR/$label-open.log" 2>&1
  else
    agent-browser --session "$SESSION" --debug --verbose --headed open > "$OUT_DIR/$label-open.log" 2>&1
  fi

  agent-browser --session "$SESSION" wait 1500 >/dev/null 2>&1 || true
  process_snapshot "${label}-after"
  browser_snapshot "$label"
}

env_snapshot

{
  echo "=== workflow ==="
  echo "1. Launch in a clean blank state to isolate browser startup."
  echo "2. Re-run against a real app URL if the blank launch only opens one browser."
  echo "3. Compare processes, sessions, tabs, and CDP URLs between the two runs."
  echo
  echo "=== phase 1 ==="
} | tee "$OUT_DIR/workflow.txt"

launch_phase blank

if [[ -n "$TARGET_URL" ]]; then
  {
    echo
    echo "=== phase 2 ==="
    echo "Target URL: $TARGET_URL"
  } | tee -a "$OUT_DIR/workflow.txt"
  launch_phase target "$TARGET_URL"
fi

cat <<EOF
Diagnostics written to:
  $OUT_DIR

Recommended next checks:
  - Compare \`blank-before-processes.txt\` vs \`blank-after-processes.txt\`.
  - Compare \`blank-sessions.txt\` vs \`blank-tabs.txt\`.
  - If blank launches cleanly but target launches twice, rerun with the URL and inspect \`target-open.log\` for config or redirect clues.
EOF
