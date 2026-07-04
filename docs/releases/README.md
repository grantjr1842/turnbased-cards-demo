# Release Runbook

This document describes how to cut a new versioned release of the
turnbased-cards-demo project.

## Versioning

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

- **MAJOR** — incompatible API or protocol changes.
- **MINOR** — backward-compatible features.
- **PATCH** — backward-compatible bug fixes.

## Prerequisites

Before cutting a release, the full verification matrix must be green on a
clean working tree:

```bash
# Server
cd server && npm install
npm test            # vitest run — all tests pass
npx tsc --noEmit    # type check clean
npm audit --omit=dev  # 0 vulnerabilities

# Web client
cd web-react && npm install
npm run test:unit   # node --test — all tests pass
npm run lint        # oxlint — 0 errors
npx tsc --noEmit    # type check clean
npm run build       # vite build — clean
npm audit --omit=dev  # 0 vulnerabilities
```

## Cutting a release

1. **Decide the version number** based on the changes since the last tag
   (`git log --oneline <last-tag>..HEAD`).

2. **Bump the version** in every `package.json`:
   - `package.json` (root)
   - `server/package.json`
   - `web-react/package.json`
   - `r3f-card-table-showcase/package.json`

   The version is the single source of truth — `server/src/version.ts` and
   `web-react/src/version.ts` both read it from their respective
   `package.json`, and the `/healthz` endpoint and lobby footer surface it
   automatically.

3. **Update `CHANGELOG.md`** — add a new `## [x.y.z] - YYYY-MM-DD` section
   at the top, organized into Added / Changed / Fixed / Performance /
   Security / Removed as applicable.

4. **Write release notes** — create `docs/releases/vx.y.z.md` with the full
   feature list, fixes, additions, verification matrix, and upgrade notes.

5. **Update `README.md`** — change the "Current version" line.

6. **Commit** all release-metadata changes:

   ```bash
   git add -A
   git commit -m "chore(release): vx.y.z"
   ```

7. **Tag** the release commit with an annotated tag:

   ```bash
   git tag -a vx.y.z -m "Release vx.y.z

   <paste the release notes summary here>"
   ```

8. **Push** the tag and branch (manual — this is externally visible):

   ```bash
   git push origin vx.y.z
   git push origin <branch>
   ```

9. **Verify** the tag is present: `git tag --list 'v*'`.

## Post-release

- Update `TODO.md` with a release marker linking to the new CHANGELOG entry.
- If applicable, create a GitHub Release from the tag.
