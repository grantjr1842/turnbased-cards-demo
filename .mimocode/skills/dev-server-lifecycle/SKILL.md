---
name: dev-server-lifecycle
description: Manage Vite + Colyseus dev processes via screen sessions on a cloud VPS. Start, restart, health check, and configure WebSocket URLs for proxy setups.
---

# Dev Server Lifecycle

Manage Vite and Colyseus dev processes via `screen` sessions on a cloud VPS. Background processes (`&`, `nohup`) die when the bash tool shell exits — `screen` is required for persistence.

## Start Services

```bash
#!/bin/bash
PROJ_DIR="/home/ubuntu/github/turnbased-cards-demo"

# Kill existing screens
screen -S uno-server -X quit 2>/dev/null
screen -S uno-vite -X quit 2>/dev/null

# Start Colyseus server
screen -dmS uno-server bash -c "cd $PROJ_DIR/server && npx tsx src/index.ts"
echo "Started uno-server"

# Wait for server
for i in $(seq 1 15); do
  curl -s http://127.0.0.1:2567/healthz > /dev/null 2>&1 && echo "Server ready on :2567" && break
  sleep 1
done

# Start Vite client
screen -dmS uno-vite bash -c "cd $PROJ_DIR/web-react && VITE_WS_URL=wss://uno-ws.mystack.dev npx vite --host 0.0.0.0 --port 5173"
echo "Started uno-vite"

# Wait for Vite
for i in $(seq 1 15); do
  curl -s http://127.0.0.1:5173/ > /dev/null 2>&1 && echo "Vite ready on :5173" && break
  sleep 1
done
```

## Restart a Service

```bash
# Restart Vite
screen -S uno-vite -X quit 2>/dev/null; sleep 1
screen -dmS uno-vite bash -c "cd /home/ubuntu/github/turnbased-cards-demo/web-react && VITE_WS_URL=wss://uno-ws.mystack.dev npx vite --host 0.0.0.0 --port 5173"

# Restart Colyseus
screen -S uno-server -X quit 2>/dev/null; sleep 1
screen -dmS uno-server bash -c "cd /home/ubuntu/github/turnbased-cards-demo/server && npx tsx src/index.ts"
```

## Health Check

```bash
curl -s -o /dev/null -w "Server: %{http_code}\n" http://127.0.0.1:2567/healthz
curl -s -o /dev/null -w "Vite: %{http_code}\n" http://127.0.0.1:5173/
curl -s -o /dev/null -w "Public: %{http_code}\n" https://uno.mystack.dev/
```

## WebSocket URL Configuration

For proxied setups, set `VITE_WS_URL` to the WebSocket subdomain:

- `VITE_WS_URL=wss://uno-ws.mystack.dev` — Colyseus via separate subdomain
- `VITE_WS_URL=ws://localhost:2567` — Local development

## Check Running Processes

```bash
ps aux | grep -E "(tsx|vite)" | grep -v grep
ss -tlnp | grep -E "(5173|2567)"
```

## Important Notes

- **Never use `&` or `nohup`** for long-running processes — they die when the bash shell exits
- **Always use `screen -dmS <name>`** for process persistence
- **Vite 7.x requires `allowedHosts`** in `vite.config.ts` for proxied domains
- **Mixed content**: HTTPS pages cannot connect to HTTP WebSocket endpoints — use `wss://`
