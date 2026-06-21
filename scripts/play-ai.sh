#!/usr/bin/env bash
# scripts/play-ai.sh
# Deprecated helper. Use `npm run test:smoke` and `npm run test:turn-actions` instead.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/web-react"
SESSION="uno-ai-play"
APP_HOST="127.0.0.1"
APP_PORT="5173"
APP_URL="http://${APP_HOST}:${APP_PORT}"
API_URL="http://127.0.0.1:2567"

# PIDs to clean up if we started them
SERVER_PID=""
CLIENT_PID=""

cleanup() {
  echo "Cleaning up..."
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Stopping server (PID $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  if [[ -n "${CLIENT_PID:-}" ]] && kill -0 "$CLIENT_PID" 2>/dev/null; then
    echo "Stopping client (PID $CLIENT_PID)..."
    kill "$CLIENT_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# 1. Start Server if not running
if ! curl --max-time 2 -fsS "$API_URL" >/dev/null 2>&1; then
  echo "Starting authoritative UNO server on $API_URL..."
  cd "$SERVER_DIR"
  npm run dev > /tmp/uno-server.log 2>&1 &
  SERVER_PID=$!
else
  echo "Authoritative UNO server is already running on $API_URL."
fi

# 2. Start Client if not running
if ! curl --max-time 2 -fsS "$APP_URL" >/dev/null 2>&1; then
  echo "Starting React client on $APP_URL..."
  cd "$CLIENT_DIR"
  npm run dev -- --host "$APP_HOST" --port "$APP_PORT" --strictPort > /tmp/uno-web.log 2>&1 &
  CLIENT_PID=$!
else
  echo "React client is already running on $APP_URL."
fi

# 3. Wait for services to be ready
echo "Waiting for services to be fully responsive..."
for _ in {1..30}; do
  if curl --max-time 2 -fsS "$API_URL" >/dev/null 2>&1 && curl --max-time 2 -fsS "$APP_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl --max-time 2 -fsS "$API_URL" >/dev/null 2>&1 || ! curl --max-time 2 -fsS "$APP_URL" >/dev/null 2>&1; then
  echo "Error: Services failed to start properly. Check /tmp/uno-server.log and /tmp/uno-web.log"
  exit 1
fi

echo "Services are ready!"

echo "This helper is deprecated."
echo "Use 'npm run test:smoke' for automated checks or 'npm run dev' for interactive work."
exit 1
