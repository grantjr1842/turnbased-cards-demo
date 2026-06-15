---
name: verification-matrix
description: Run the full test/build/lint/audit verification suite for this project. Server tests, client tests, build, lint, npm audit, and smoke tests.
---

# Verification Matrix

Run the complete verification suite before claiming work is complete.

## Full Matrix

```bash
cd /home/ubuntu/github/turnbased-cards-demo

echo "=== Server Tests ==="
cd server && npm test 2>&1 | tail -5 && cd ..

echo "=== Server Build ==="
cd server && npm run build 2>&1 | tail -3 && cd ..

echo "=== Client Tests ==="
cd web-react && npm run test:unit 2>&1 | tail -5 && cd ..

echo "=== Client Build ==="
cd web-react && npm run build 2>&1 | tail -5 && cd ..

echo "=== Client Lint ==="
cd web-react && npm run lint 2>&1 | tail -3 && cd ..

echo "=== npm audit (server) ==="
cd server && npm audit --omit=dev 2>&1 | tail -3 && cd ..

echo "=== npm audit (client) ==="
cd web-react && npm audit --omit=dev 2>&1 | tail -3 && cd ..
```

## Quick Check (non-interactive)

```bash
cd /home/ubuntu/github/turnbased-cards-demo
cd server && npm test 2>&1 | grep -E "Tests|FAIL" | tail -3 && cd ..
cd web-react && npm run test:unit 2>&1 | grep -E "pass|fail" | tail -3 && cd ..
cd web-react && npm run lint 2>&1 | tail -2 && cd ..
```

## Expected Results

| Check | Server | Client |
|-------|--------|--------|
| Tests | 271+ pass | 20+ pass |
| Build | Clean (tsc --noEmit) | Clean (tsc + vite) |
| Lint | n/a | 0 errors, 0 warnings |
| Audit | 0 vulnerabilities | 0 vulnerabilities |

## Smoke Tests (requires running server)

```bash
cd web-react && xvfb-run -a npm run test:smoke
```

## Public URL Check

```bash
curl -s -o /dev/null -w "%{http_code}" https://uno.mystack.dev/
# Expected: 200
```
