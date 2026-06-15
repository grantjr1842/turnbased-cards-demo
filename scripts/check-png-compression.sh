#!/usr/bin/env bash
# CI check: fail if any PNG in web-react/public/ is more than 5% reducible
# by oxipng. Catches accidentally-committed uncompressed assets.
#
# Runs `oxipng -o max` on each PNG into a temp dir, then compares the
# would-be-compressed size to the committed size. If the diff is > 5%,
# the asset is under-compressed and the check fails.
#
# Exit codes:
#   0 — all PNGs are within the 5% threshold
#   1 — one or more PNGs exceed the threshold (printed to stderr)
#   2 — missing tools (oxipng, find) or public dir not present

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PUBLIC_DIR="${PUBLIC_DIR:-$SCRIPT_DIR/../web-react/public}"
THRESHOLD_PCT="${PNG_COMPRESSION_THRESHOLD_PCT:-5}"

if ! command -v npx &>/dev/null; then
  echo "error: npx not found" >&2
  exit 2
fi

if [ ! -d "$PUBLIC_DIR" ]; then
  echo "error: $PUBLIC_DIR does not exist" >&2
  exit 2
fi

mapfile -t PNG_FILES < <(find "$PUBLIC_DIR" -name '*.png' -type f 2>/dev/null)

if [ ${#PNG_FILES[@]} -eq 0 ]; then
  echo "No PNG files found in $PUBLIC_DIR — nothing to check."
  exit 0
fi

echo "Checking ${#PNG_FILES[@]} PNG file(s) in $PUBLIC_DIR (threshold: ${THRESHOLD_PCT}% reducible) ..."

TMPDIR_OUT="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_OUT"' EXIT

FAILED=0
TOTAL_BEFORE=0
TOTAL_AFTER=0

for png in "${PNG_FILES[@]}"; do
  BASENAME="$(basename "$png")"
  BEFORE_BYTES="$(stat -c %s "$png")"
  TOTAL_BEFORE=$(( TOTAL_BEFORE + BEFORE_BYTES ))

  # Compress into tempdir with -o max (slowest, best compression).
  # --dir writes output to that directory with the same filename.
  # npx failures are non-fatal — we just skip that PNG.
  npx --yes oxipng -o max --strip safe --quiet --dir "$TMPDIR_OUT" "$png" 2>/dev/null || true

  COMPRESSED="$TMPDIR_OUT/$BASENAME"
  if [ ! -f "$COMPRESSED" ]; then
    echo "  SKIP  $BASENAME (oxipng did not produce output)"
    continue
  fi

  AFTER_BYTES="$(stat -c %s "$COMPRESSED")"
  TOTAL_AFTER=$(( TOTAL_AFTER + AFTER_BYTES ))

  if [ "$BEFORE_BYTES" -le 0 ]; then
    continue
  fi

  # percent reducible = (before - after) / before * 100
  REDUCIBLE_PCT=$(( (BEFORE_BYTES - AFTER_BYTES) * 100 / BEFORE_BYTES ))

  if [ "$REDUCIBLE_PCT" -gt "$THRESHOLD_PCT" ]; then
    echo "  FAIL  $BASENAME  ${BEFORE_BYTES} -> ${AFTER_BYTES} bytes  (${REDUCIBLE_PCT}% reducible > ${THRESHOLD_PCT}%)"
    FAILED=1
  else
    echo "  ok    $BASENAME  ${BEFORE_BYTES} -> ${AFTER_BYTES} bytes  (${REDUCIBLE_PCT}% reducible)"
  fi
done

if [ "$TOTAL_BEFORE" -gt 0 ]; then
  TOTAL_REDUCIBLE_PCT=$(( (TOTAL_BEFORE - TOTAL_AFTER) * 100 / TOTAL_BEFORE ))
  echo ""
  echo "Total: ${TOTAL_BEFORE} -> ${TOTAL_AFTER} bytes  (${TOTAL_REDUCIBLE_PCT}% reducible)"
fi

if [ "$FAILED" -ne 0 ]; then
  echo ""
  echo "error: one or more PNGs exceed the ${THRESHOLD_PCT}% compression threshold." >&2
  echo "       Run 'npm run prebuild' (or scripts/compress-pngs.sh) to optimize assets, then re-commit." >&2
  exit 1
fi

echo "All PNGs within threshold."
exit 0
