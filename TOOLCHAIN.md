# Toolchain

> Operator's quick reference for the Node.js + pnpm pins and the pnpm 11
> configuration that holds the rest of the repo together. If something here
> disagrees with what you see on disk, the files win — update this doc.

## Pinned versions

| Tool | Version | Source of truth |
| --- | --- | --- |
| Node.js | `22.22.0` | `mise.toml` (`[tools] node`) |
| pnpm | `11.5.2` | `mise.toml` (`[tools] pnpm`) + `packageManager` in every manifest |
| corepack | bundled with Node 22, strict mode | `[env] COREPACK_ENABLE_STRICT = "1"` in `mise.toml` |

Every `package.json` in the repo (`/`, `web-react/`, `server/`) declares
`engines: { node: ">=22.22.0 <23", pnpm: ">=11.5.2 <12" }` and
`packageManager: "pnpm@11.5.2"`. Keep all three in sync.

## Where each pnpm setting lives

pnpm 11 changed the resolution rule: **only auth and registry settings are
read from `.npmrc`.** Everything else lives in `pnpm-workspace.yaml` (in
the workspace that owns the lockfile) or in the user/global
`~/.config/pnpm/config.yaml`.

In this repo that means:

- **`.npmrc`** (comment-only) — left intentionally empty of policy. It may
  still hold `//registry.npmjs.org/:_authToken=…` for private registries.
- **`web-react/pnpm-workspace.yaml`** — the only place pnpm 11 reads
  `packages`, `minimumReleaseAge`, and `allowBuilds` from.
- **`web-react/pnpm-lock.yaml`** — the single lockfile for the repo. There
  is no lockfile at the repo root (the root `package.json` has no
  `workspaces` field and is not a real workspace root).

If a setting is silently being ignored, you almost certainly put it in the
wrong file. The CLI override for ad-hoc work is
`pnpm <cmd> --config.<camelCaseKey>=<value>`, e.g.
`--config.minimumReleaseAge=0`.

## `allowBuilds` — opt-in build scripts

pnpm 11 no longer runs install scripts by default; transitive deps that
need to compile native code must be explicitly allowed. The current
allowlist and the reason each entry exists:

| Package | Needed by | Why it has an install script |
| --- | --- | --- |
| `esbuild` | `vite` (devDep in `web-react/`) | Downloads a platform-specific native binary at install time. |
| `msgpackr-extract` | `@colyseus/msgpackr` ← `@colyseus/sdk` | Optional native speedup for the msgpack codec; falls back to pure JS if absent. |

When a new transitive dep with an install script shows up, pnpm will print
`ERR_PNPM_IGNORED_BUILDS` and the binary it would have produced will be
missing. Add the package to `allowBuilds` only after confirming the
transitive chain in `pnpm why <pkg> -r`.

## `minimumReleaseAge`

Set to `0` in `web-react/pnpm-workspace.yaml`. pnpm 11's default is
`1440` minutes (24h) — newly published versions are quarantined and
blocked even with a clean lockfile. Zeroing it out is the policy choice
for this repo; revisit if a supply-chain incident makes the 24h
quarantine desirable.

## Workflow reminders

- `mise exec -- pnpm install` (or just `pnpm install` after
  `eval "$(mise activate zsh)"`) — install from `web-react/` to update
  the shared lockfile.
- `pnpm run lint` — runs `oxlint`; should report
  `0 warnings and 0 errors`.
- If `pnpm` reports a wrong version, check `which -a pnpm`. Multiple
  binaries on `PATH` (apt, corepack, mise, `~/.local/share/pnpm`) cause
  exactly this symptom. The single source of truth is the mise install at
  `~/.local/share/mise/installs/pnpm/<version>/pnpm`.

## Related docs

- [`README.md`](README.md) — project overview and client matrix.
- [`QUICKSTART.md`](QUICKSTART.md) — local run instructions.
- [`web-react/AGENTS.md`](web-react/AGENTS.md) — web client conventions.
