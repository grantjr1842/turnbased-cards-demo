# Changelog

All notable changes to the turnbased-cards-demo project are documented in this
file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html/).

Full release notes for each version live in [`docs/releases/`](docs/releases/).

## [1.0.0] - 2026-07-04

The inaugural production release. Consolidates the completed production
roadmap (client performance, server scalability, observability, QA/security)
with a final hardening pass, dependency cleanup, repo hygiene, and version
reporting. See [docs/releases/v1.0.0.md](docs/releases/v1.0.0.md) for full
details.

### Added
- Server game-duration Prometheus metric (`game_duration_seconds` histogram).
- Server seat-takeover helper (`assignSeatToClient`) for consistent
  bot-seat replacement on rejoin.
- Server `/healthz` version reporting — now returns `{ status, version }`.
- Web client connection-error feedback module (`connectionFeedback.ts`) with
  friendly user-facing messages for join/disconnect failures.
- Web client ambient soundscape + new SFX (swish, chime, turn-alert,
  heartbeat, uno, error) with a master-gain bus.
- Web client lobby footer version display.
- Web client turn UX copy revamp.
- CI PNG compression regression check (Epic 1.3.4).
- Coach smoke check in the web client smoke suite.
- Release runbook (`docs/releases/README.md`).
- Redis presence incident runbook
  (`docs/incident-response/redis-presence-lost.md`).
- Bot timing side-channel documentation (Epic 4.3.4).
- Server and web client version test coverage.

### Changed
- Spectators can join private tables without a password (active players
  still require it).
- `TurnTimerRing` refactored to direct DOM mutations (eliminates per-frame
  React re-renders).
- `docs/protocol.md` and `docs/security.md` updated to reference
  `sanitizePlainText()` instead of DOMPurify.
- `server/tsconfig.json` enabled `resolveJsonModule`.
- Package versions bumped to `1.0.0` (root, server, web client, R3F
  showcase).

### Fixed
- Rematch-vote wipe on disconnect — `onLeave` now only drops the departing
  player's own vote instead of wiping all votes.
- Removed unused `dompurify` and `@types/dompurify` dependencies (clears
  moderate DOMPurify CVE).
- Pinned transitive `ws` to `^8.21.0` via overrides (clears high-severity
  ws DoS advisory GHSA-96hv-2xvq-fx4p).
- CI PNG check step working-directory.

### Performance
- `TurnTimerRing` DOM-mutation refactor eliminates per-frame re-renders.
- `React.memo` + stable callbacks reduce per-card re-renders.

### Security
- Helmet, CORS allow-list, body-size limits via Express middleware.
- Per-message-type rate limiting.
- Zod payload validation for all message handlers.
- Anti-cheat audit (StateView filtering, RNG analysis, bot timing).
- `npm audit --omit=dev` reports 0 vulnerabilities on both server and
  client.

### Removed
- 72 orphaned root-level dev screenshots/videos (~26 MB).
- 4 junk files: `--out`, `card_styles.json`, `dom.html`, `dom.txt`.
- `.stitch/` agent-scaffolding directory.
- `dompurify` and `@types/dompurify` dead dependencies.
