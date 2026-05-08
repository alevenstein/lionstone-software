#!/usr/bin/env bash
# Vendor the playable Defendor files into public/play/defendor/.
#
# Defendor lives in its own repo; we copy only the files that need to be
# served (index.html, manifest.json, icon.svg, src/). Private folders
# (memory/, screenshots/, specs/) and dev docs (README.md, Cloudflare.md)
# are skipped on purpose.
#
# Override the source path with DEFENDOR_SRC if Defendor moves:
#   DEFENDOR_SRC=/path/to/defendor npm run sync-defendor
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SRC="${DEFENDOR_SRC:-/c/Users/cleon/work/defendor}"
DST="$ROOT/public/play/defendor"

if [ ! -d "$SRC" ]; then
  echo "error: Defendor source not found at $SRC" >&2
  echo "Set DEFENDOR_SRC to override the source path." >&2
  exit 1
fi

for f in index.html manifest.json icon.svg; do
  if [ ! -f "$SRC/$f" ]; then
    echo "error: required file missing in source: $f" >&2
    exit 1
  fi
done
if [ ! -d "$SRC/src" ]; then
  echo "error: required directory missing in source: src/" >&2
  exit 1
fi

mkdir -p "$DST"
cp "$SRC/index.html" "$DST/"
cp "$SRC/manifest.json" "$DST/"
cp "$SRC/icon.svg" "$DST/"
rm -rf "$DST/src"
cp -r "$SRC/src" "$DST/"

echo "Synced Defendor: $SRC -> $DST"
