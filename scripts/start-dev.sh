#!/bin/bash
# Start UNO dev services in screen sessions
PROJ_DIR="/home/ubuntu/github/turnbased-cards-demo"

# Kill existing screens
screen -S uno-server -X quit 2>/dev/null
screen -S uno-vite -X quit 2>/dev/null

# Start Colyseus in a screen
screen -dmS uno-server bash -c "cd $PROJ_DIR/server && npx tsx src/index.ts"
echo "Started uno-server screen"

# Wait for server
for i in $(seq 1 15); do
  if curl -s http://127.0.0.1:2567/healthz > /dev/null 2>&1; then
    echo "Server ready on :2567"
    break
  fi
  sleep 1
done

# Start Vite in a screen
screen -dmS uno-vite bash -c "cd $PROJ_DIR/web-react && VITE_WS_URL=wss://uno.mystack.dev npx vite --host 0.0.0.0 --port 5173"
echo "Started uno-vite screen"

# Wait for Vite
for i in $(seq 1 15); do
  if curl -s http://127.0.0.1:5173/ > /dev/null 2>&1; then
    echo "Vite ready on :5173"
    break
  fi
  sleep 1
done

echo "=== All services running ==="
curl -s -o /dev/null -w "Server healthz: %{http_code}\n" http://127.0.0.1:2567/healthz
curl -s -o /dev/null -w "Vite local: %{http_code}\n" http://127.0.0.1:5173/
curl -s -o /dev/null -w "Public site: %{http_code}\n" https://uno.mystack.dev/
