---
name: caddy-api
description: Manage routes on an existing system Caddy instance via its JSON API at localhost:2019. Read config, add/modify/delete routes, handle WebSocket proxying, and test endpoints.
---

# Caddy API Route Manager

Manage routes on a running system Caddy instance via its administration API at `localhost:2019`.

## Prerequisites

- System Caddy running on port 443 with admin API at localhost:2019
- Routes managed via `POST http://localhost:2019/load` with full JSON config

## Read Current Config

```bash
# List all routes
curl -s http://localhost:2019/config/ | python3 -c "
import sys, json
cfg = json.load(sys.stdin)
routes = cfg['apps']['http']['servers']['srv0']['routes']
for i, r in enumerate(routes):
    match = r.get('match', [{}])
    host = match[0].get('host', ['?'])[0] if match else '?'
    terminal = r.get('terminal', False)
    print(f'{i}: {host} terminal={terminal}')
"

# Get specific route
curl -s http://localhost:2019/config/ | python3 -c "
import sys, json
cfg = json.load(sys.stdin)
routes = cfg['apps']['http']['servers']['srv0']['routes']
for r in routes:
    match = r.get('match', [{}])
    host = match[0].get('host', ['?'])[0] if match else '?'
    if host == 'your-domain.mystack.dev':
        print(json.dumps(r, indent=2))
        break
"
```

## Add/Update a Route

```bash
curl -s http://localhost:2019/config/ | python3 -c "
import sys, json, urllib.request
cfg = json.load(sys.stdin)
routes = cfg['apps']['http']['servers']['srv0']['routes']

# Add new route
new_route = {
    'match': [{'host': ['your-domain.mystack.dev']}],
    'handle': [{
        'handler': 'reverse_proxy',
        'upstreams': [{'dial': '127.0.0.1:3000'}],
        'flush_interval': -1  # Required for WebSocket support
    }]
}
routes.append(new_route)

# POST updated config
req = urllib.request.Request(
    'http://localhost:2019/load',
    data=json.dumps(cfg).encode(),
    headers={'Content-Type': 'application/json'},
    method='POST'
)
resp = urllib.request.urlopen(req)
print(f'Updated: {resp.status}')
"
```

## WebSocket Proxying

For WebSocket support, use `flush_interval: -1`:

```python
{
    'handler': 'reverse_proxy',
    'upstreams': [{'dial': '127.0.0.1:2567'}],
    'flush_interval': -1
}
```

## Health Check

```bash
curl -s -o /dev/null -w "%{http_code}" https://your-domain.mystack.dev/
```

## Common Patterns

### Split WebSocket and HTTP traffic

Use separate subdomains to avoid conflicts (e.g., Vite HMR vs game server WebSocket):

- `app.mystack.dev` → Vite (port 5173) — page + HMR
- `app-ws.mystack.dev` → Colyseus (port 2567) — matchmake + WebSocket

### Route ordering

Routes are matched top-to-bottom. `terminal: true` stops further matching.
