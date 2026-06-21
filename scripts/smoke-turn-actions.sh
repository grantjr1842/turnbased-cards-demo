#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/web-react"
SESSION="card-demo-turn-actions"
APP_HOST="${APP_HOST:-127.0.0.1}"
APP_PORT="${APP_PORT:-5173}"
if [[ -n "${APP_URL+x}" ]]; then
  APP_URL_PROVIDED=1
fi
APP_URL="${APP_URL:-http://${APP_HOST}:${APP_PORT}}"
API_URL="${API_URL:-http://127.0.0.1:2567}"
BROWSER_BIN="${BROWSER_BIN:-$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)}"
BROWSER_PORT="${BROWSER_PORT:-$(
  node -e "const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close();});"
)}"

cleanup() {
  if [[ -n "${CLIENT_PID:-}" ]] && kill -0 "$CLIENT_PID" 2>/dev/null; then kill "$CLIENT_PID" 2>/dev/null || true; fi
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then kill "$SERVER_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

start_stack() {
  cd "$SERVER_DIR"
  if ! curl --max-time 3 -fsS "${API_URL}/healthz" >/dev/null 2>&1; then
    npm run dev > /tmp/uno-server.log 2>&1 &
    SERVER_PID=$!
  fi

  cd "$CLIENT_DIR"
  if ! curl --max-time 3 -fsS "$APP_URL" >/dev/null 2>&1; then
    if [[ -z "${APP_URL_PROVIDED:-}" && "$APP_URL" == "http://${APP_HOST}:5173" ]]; then
      APP_PORT="$(
        node -e "const s=require('node:net').createServer();s.listen(0,'${APP_HOST}',()=>{console.log(s.address().port);s.close();});"
      )"
      APP_URL="http://${APP_HOST}:${APP_PORT}"
    fi
    npm run dev -- --host "$APP_HOST" --port "$APP_PORT" --strictPort > /tmp/uno-web.log 2>&1 &
    CLIENT_PID=$!
  fi

  for _ in {1..40}; do
    if curl --max-time 3 -fsS "${API_URL}/healthz" >/dev/null 2>&1 && curl --max-time 3 -fsS "$APP_URL" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  curl --max-time 3 -fsS "${API_URL}/healthz" >/dev/null
  curl --max-time 3 -fsS "$APP_URL" >/dev/null
}

run_browser_checks() {
  ROOT_DIR="$ROOT_DIR" APP_URL="$APP_URL" BROWSER_PORT="$BROWSER_PORT" node --input-type=module <<'NODE'
const baseUrl = process.env.APP_URL;
const debugUrl = (scenario) => `${baseUrl}?debugTurn=${scenario}`;
const helperUrl = `file://${process.env.ROOT_DIR}/scripts/browser-cdp-helper.mjs`;
const {
  checkClean,
  cleanupChrome,
  click,
  connectCdp,
  evalScript,
  fill,
  navigate,
  resolveChromeBinary,
  startChrome,
  waitFor,
  waitForChrome,
} = await import(helperUrl);

const browser = startChrome({
  chromeBin: resolveChromeBinary(),
  debugPort: Number(process.env.BROWSER_PORT),
  userDataDirPrefix: "/tmp/uno-turn-actions-browser",
});
await waitForChrome(Number(process.env.BROWSER_PORT));
const cdp = await connectCdp(Number(process.env.BROWSER_PORT));

async function joinTable(playerName) {
  await fill(cdp, 'input[placeholder="Enter your player name"]', playerName);
  await click(cdp, ".primary-btn");
  await waitFor(cdp, 'document.querySelector(".game-shell") !== null', 30000);
}

await navigate(cdp, debugUrl("lockedHand"));
await joinTable("Turn Smoke A");
await waitFor(cdp, 'document.querySelector(".hand-card-wrapper.locked") !== null');
await waitFor(cdp, 'document.querySelector(".hand-card-wrapper.locked button[disabled]") !== null');
await waitFor(cdp, '(function() { const el = document.querySelector(".topbar .topbar-stat strong"); return !!el && !(el.textContent || "").includes("Your move"); })()');

await navigate(cdp, debugUrl("drawPenalty"));
await joinTable("Turn Smoke B");
await waitFor(cdp, 'document.querySelector(".draw-pile.guidance-pulse") !== null');
await waitFor(cdp, '(function() { const el = document.querySelector(".draw-pile.guidance-pulse .draw-guidance-tooltip span"); if (!el) return false; const text = (el.textContent || "").trim(); return text.length > 0 && (text === "Draw a card!" || /^Take \\+[0-9]+$/.test(text)); })()');

await checkClean(cdp, "turn-actions");
cdp.close();
cleanupChrome(browser);
console.log("turn-action smoke passed");
NODE
}

start_stack
run_browser_checks
