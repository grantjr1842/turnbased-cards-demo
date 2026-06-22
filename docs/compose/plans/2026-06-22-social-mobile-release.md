# Social, Mobile, and Ops Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the next release as one coherent version: social room controls, mobile-first parity, and deployment hardening for the maintained React UNO client.

**Architecture:** Keep the release split into independent slices so each slice can be built, reviewed, and verified on its own. Social gameplay changes stay in room state, lobby, and HUD code; mobile work stays in CSS and gesture handling; deployment and scale work stay in server config and docs; release QA stays in the smoke harness and verification gates.

**Tech Stack:** React 19, TypeScript, Vite, Colyseus 0.17, @colyseus/schema 4, Vitest, agent-browser, Redis

## Global Constraints

- Preserve the maintained DOM/CSS React client; do not reintroduce a 3D renderer dependency.
- Use `./scripts/smoke-web-agent-browser.sh` for browser QA; never use Playwright in this repo.
- Keep `cd server && npm test`, `cd server && npm run build`, `cd web-react && npm run lint`, `cd web-react && npm run build`, and `git diff --check` as release gates.
- Keep browser artifacts and release evidence reproducible from the current tree.
- Maintain compatibility with the existing room join flow and current server/client protocol shape.

---

### Task 1: Social Room Package

**Files:**
- Modify: `server/src/rooms/schema/UnoRoomState.ts`
- Modify: `server/src/rooms/UnoRoom.ts`
- Modify: `web-react/src/main.tsx`
- Modify: `web-react/src/components/Game.tsx`
- Modify: `docs/protocol.md`

**Interfaces:**
- Consumes: existing room state, join flow, winner overlay, and `restart` / `play_card` / `draw_card` message patterns.
- Produces: room-password handling, rematch voting, local stats presentation, and protocol docs that explain the new social loop.

- [ ] **Step 1: Define the social loop scope**

Ship the release with a room lifecycle users can understand without outside coordination:

- private rooms protected by a password
- a rematch vote that restarts only when all connected humans agree
- a visible player stats summary in the lobby or options overlay
- updated protocol notes for any new server messages

- [ ] **Step 2: Add the room-state and server-side messages**

Update the room schema and room logic so the server owns the authoritative finish/rematch state. The release should preserve the current join flow while adding the new vote/restart path and password validation on join.

- [ ] **Step 3: Surface the social features in the client**

Update the lobby and winner overlay so players can:

- create or join a private room with a password
- vote for a rematch after a game ends
- view basic stats without leaving the app flow

- [ ] **Step 4: Verify the social loop**

Run:

```bash
cd server && npm test
cd web-react && npm run build
```

Expected: server tests pass, and the client still builds cleanly after the new social-state wiring.

- [ ] **Step 5: Commit**

```bash
git add server/src/rooms/schema/UnoRoomState.ts \
        server/src/rooms/UnoRoom.ts \
        web-react/src/main.tsx \
        web-react/src/components/Game.tsx \
        docs/protocol.md
git commit -m "feat: release social room flow"
```

---

### Task 2: Mobile-First Playability

**Files:**
- Modify: `web-react/src/index.css`
- Modify: `web-react/src/components/GameScene.tsx`
- Modify: `web-react/src/components/Game.tsx`

**Interfaces:**
- Consumes: current HUD controls, winner overlay, card hit targets, and keyboard shortcuts.
- Produces: a layout that remains usable at phone widths and on touch-only devices.

- [ ] **Step 1: Lock in responsive layout rules**

Tighten the mobile breakpoints so the lobby, HUD, hand dock, chat, and winner overlay all fit without horizontal scrolling at 375px wide.

- [ ] **Step 2: Add touch interaction support**

Add swipe handling for card navigation and keep touch targets large enough for thumb use.

- [ ] **Step 3: Keep accessibility in the same pass**

Preserve reduced-motion behavior, button labels, and keyboard shortcuts so the mobile work does not regress screen-reader or keyboard usability.

- [ ] **Step 4: Verify on mobile viewports**

Run the browser smoke script and inspect at least one narrow phone viewport and one common modern phone viewport.

```bash
./scripts/smoke-web-agent-browser.sh
```

Expected: the lobby joins, the table renders, and the smoke artifacts are produced without viewport clipping or fatal console errors.

- [ ] **Step 5: Commit**

```bash
git add web-react/src/index.css \
        web-react/src/components/GameScene.tsx \
        web-react/src/components/Game.tsx
git commit -m "feat: mobile-first playability improvements"
```

---

### Task 3: Deployability and Scale

**Files:**
- Modify: `server/src/app.config.ts`
- Modify: `server/package.json`
- Modify: `docs/deployment.md`
- Modify: `.github/workflows/client.yml`
- Modify: `.github/workflows/server.yml`

**Interfaces:**
- Consumes: current server startup path, CI workflows, and deployment documentation.
- Produces: optional Redis-backed presence, clear environment-variable documentation, and CI that still reflects shared-rule changes.

- [ ] **Step 1: Make Redis support optional**

Wire Redis presence so horizontal scaling can be enabled by environment without breaking local development.

- [ ] **Step 2: Document the deployment contract**

Document the exact environment variables and startup expectations required for this release so a deployer can run the app without guessing at hidden config.

- [ ] **Step 3: Keep CI honest**

Make sure the workflows still run the right tests when shared rules, server logic, or smoke files change.

- [ ] **Step 4: Verify startup paths**

Run:

```bash
cd server && npm run build
cd server && npm start
```

Expected: the server builds and starts with no Redis configured.

- [ ] **Step 5: Commit**

```bash
git add server/src/app.config.ts \
        server/package.json \
        docs/deployment.md \
        .github/workflows/client.yml \
        .github/workflows/server.yml
git commit -m "feat: release deployability and scaling"
```

---

### Task 4: Release QA and Evidence

**Files:**
- Modify: `scripts/smoke-web-agent-browser.sh`
- Modify: `TODO.md`
- Modify: `docs/compose/plans/2026-06-22-social-mobile-release.md`

**Interfaces:**
- Consumes: the full release surface from Tasks 1 to 3.
- Produces: a repeatable release evidence trail with smoke artifacts, test gates, and a release checklist that can be audited later.

- [ ] **Step 1: Harden the smoke harness**

Keep the browser smoke deterministic enough to be useful as a release gate, not just a local demo.

- [ ] **Step 2: Refresh the release checklist**

Capture the release-sized scope in `TODO.md` so the next maintainer can see what shipped and what remains as follow-on work.

- [ ] **Step 3: Run the final gates**

Run:

```bash
cd server && npm test
cd server && npm run build
cd web-react && npm run lint
cd web-react && npm run build
./scripts/smoke-web-agent-browser.sh
git diff --check
```

Expected: all gates pass on the release tree and the smoke run produces reviewable artifacts.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-web-agent-browser.sh TODO.md docs/compose/plans/2026-06-22-social-mobile-release.md
git commit -m "docs: record social mobile release scope"
```

---

## Stretch Candidates For The Following Release

- Persistent player profiles instead of local-only stats.
- Shareable invite links that prefill room and password fields.
- Match history or replay viewer for completed games.
- Spectator controls for muting or filtering chat noise.
- Seasonal rulesets or alternate game modes without rewriting the core room.

## Release Acceptance Checklist

- [ ] Social room flow is documented and implemented.
- [ ] Mobile layout and touch behavior are release-ready.
- [ ] Deployment and scale settings are documented and verified.
- [ ] Smoke artifacts exist for review.
- [ ] The release tree passes the server, client, smoke, and hygiene gates.
