#!/usr/bin/env bash
# Exercises the release-prune block against a fixture tree.
#
#   4 releases, `current` -> the OLDEST, cap 2. Survivors must be exactly the
#   live release plus the one newest non-live.
#
# That fixture is chosen because it is the case the old guard got wrong:
# `readlink` returns an absolute path while `ls -1d` yields `dir/` with a
# trailing slash, so `[ "$dir" = "$active_target" ]` could never match and the
# LIVE release was pruned purely on mtime order — taking the running release
# with it.
#
# Run: bash scripts/tests/prune-release-cap.sh [path-to-deploy-script]
set -Eeuo pipefail

SRC="${1:-$(dirname "$0")/../deploy-direct.sh}"
FIX=$(mktemp -d "${TMPDIR:-/tmp}/prune-fixture.XXXXXX")
trap 'rm -rf "$FIX"' EXIT

RELEASES_DIR="$FIX/releases"
CURRENT_LINK="$FIX/current"
KEEP_RELEASES=2

# Oldest first, so newest = last created. current -> OLDEST on purpose.
mkdir -p "$RELEASES_DIR"/{aaa1111,bbb2222,ccc3333,ddd4444}
touch -d "2026-01-01" "$RELEASES_DIR"/aaa1111
touch -d "2026-01-02" "$RELEASES_DIR"/bbb2222
touch -d "2026-01-03" "$RELEASES_DIR"/ccc3333
touch -d "2026-01-04" "$RELEASES_DIR"/ddd4444
ln -s "$RELEASES_DIR/aaa1111" "$CURRENT_LINK"

log() { printf '[test] %s\n' "$*"; }
die() { printf '[test] ERROR: %s\n' "$*" >&2; exit 1; }
# GMW prunes with a bare `sudo rm`, the others go through as_root; either is fine.
as_root() { "$@"; }
sudo() { "$@"; }
RELEASE_DIR="$RELEASES_DIR/ddd4444"

# Locate the prune block by its terminating log line rather than its banner: the
# sibling scripts label it differently, and matching on structure means one
# harness can guard all of them.
sed -n '/keeping live + 1 rollback/,/releases now:/p' "$SRC" > "$FIX/prune.sh"
grep -q "LIVE_SHA=" "$FIX/prune.sh" || {
  echo "[test] FAILED to locate the prune block in $SRC"; exit 1; }

echo "[test] --- running extracted prune block ---"
# shellcheck disable=SC1090
( . "$FIX/prune.sh" )

# Fixture: 4 releases by mtime, current -> aaa1111 which is the OLDEST.
# Cap is 2 and that budget is shared, so survivors = live(aaa1111) + the single
# newest non-live (ddd4444). ccc3333/bbb2222 are unreachable: a rollback targets
# exactly one previous release.
#
# This is the case the OLD guard missed: readlink gives the absolute path while
# the loop yields "dir/", so `[ "$dir" = "$active_target" ]` could never match
# and the live release was pruned purely on mtime order.
remaining=$(ls -1 "$RELEASES_DIR" | sort | tr '\n' ' ')
echo "[test] remaining: $remaining"

fail=0
# `set -e` note: an `&&` chain returning false would abort the harness, so each
# branch is an explicit if.
check() {
  if [ "$1" = "keep" ]; then
    if [ ! -d "$2" ]; then echo "[test] FAIL: $3 should have been kept"; fail=1; fi
  else
    if [ -d "$2" ]; then echo "[test] FAIL: $3 should have been pruned"; fail=1; fi
  fi
  return 0
}

check keep "$RELEASES_DIR/aaa1111" "live release (oldest by mtime)"
check keep "$RELEASES_DIR/ddd4444" "just-deployed release (newest, the rollback target)"
check drop "$RELEASES_DIR/ccc3333" "second-newest, beyond the cap"
check drop "$RELEASES_DIR/bbb2222" "second-oldest"

count=$(ls -1 "$RELEASES_DIR" | wc -l)
[ "$count" -le 2 ] || { echo "[test] FAIL: $count releases kept, cap is 2"; fail=1; }

[ "$fail" -eq 0 ] && echo "[test] PASS: exactly 2 kept (live + 1 rollback), live never pruned by mtime"
exit "$fail"