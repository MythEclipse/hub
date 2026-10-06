#!/usr/bin/env bash
#
# Direct pnpm + systemd deploy for hub.
#
# .github/workflows/deploy.yml scps THIS file out of the checkout of the commit
# being deployed and runs it on the VPS as:
#
#     bash /tmp/hub-deploy-direct.sh <git-sha> <ref>
#
# The script is shipped from the checkout (never read from the running payload)
# so the deploy logic always matches the commit that is being released.
#
# Flow:
#   1. clone <git-sha> into $RELEASES_DIR/<git-sha>
#   2. pnpm install --frozen-lockfile && pnpm build
#   3. atomically flip the $CURRENT_LINK symlink to the new release
#   4. restart the systemd unit
#   5. health-check GET / with curl --retry (no sleep loops)
#   6. on failure: flip back to the previous release, restart, re-check
#   7. prune old releases (keeps $KEEP_RELEASES newest, never the active one)
#
# Overrides (defaults are the production values; used for verification runs):
#   RELEASES_DIR CURRENT_LINK UNIT HEALTH_URL DEPLOY_REPO_URL KEEP_RELEASES
#   SKIP_RESTART=1  -> skip the systemd restart (verification only)
set -Eeuo pipefail

REPO_URL="${DEPLOY_REPO_URL:-https://github.com/asepharyana/hub.git}"
RELEASES_DIR="${RELEASES_DIR:-/opt/hub/releases}"
CURRENT_LINK="${CURRENT_LINK:-/opt/hub/current}"
PREV_DIR="${CURRENT_LINK}.previous"
UNIT="${UNIT:-hub}"
PORT="${PORT:-4003}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT}/}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
SKIP_RESTART="${SKIP_RESTART:-0}"

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

SHA="${1:-}"
REF="${2:-main}"
[ -n "$SHA" ] || die "usage: $0 <git-sha> [ref]"

# ── privileges ─────────────────────────────────────────────────────────────
# Writes under /opt/hub and systemctl need root when the deploy user is not
# root itself; use passwordless sudo when available, plain commands otherwise.
as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif sudo -n true 2>/dev/null; then
    sudo -n "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    "$@"
  fi
}

# ── toolchain ──────────────────────────────────────────────────────────────
resolve_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    command -v pnpm
  elif [ -x "${HOME:-/nonexistent}/.local/bin/pnpm" ]; then
    printf '%s\n' "${HOME}/.local/bin/pnpm"
  elif command -v corepack >/dev/null 2>&1; then
    printf 'corepack pnpm'
  else
    die "pnpm not found on PATH (expected corepack/pnpm >= 10)"
  fi
}
PNPM="$(resolve_pnpm)"

command -v node >/dev/null 2>&1 || die "node not found on PATH"
command -v git  >/dev/null 2>&1 || die "git not found on PATH"
command -v curl >/dev/null 2>&1 || die "curl not found on PATH"
log "node $(node -v) | $($PNPM --version 2>/dev/null || echo 'pnpm ?') | user $(id -un)"

# ── state captured before we touch anything ────────────────────────────────
PREV_TARGET=""
if [ -L "$CURRENT_LINK" ]; then
  PREV_TARGET="$(readlink "$CURRENT_LINK")"
elif [ -d "$CURRENT_LINK" ]; then
  # First deploy: /opt/hub/current is a real directory (pre-pnpm payload).
  PREV_TARGET="$PREV_DIR"
fi
ACTIVATED=0

rollback() {
  # Deliberately defensive: never let rollback itself abort the script.
  set +e
  trap - ERR
  log "ROLLING BACK"
  if [ -n "$PREV_TARGET" ] && [ -e "$PREV_TARGET" ]; then
    log "restoring $CURRENT_LINK -> $PREV_TARGET"
    tmp="${CURRENT_LINK}.rollback.$$"
    as_root ln -sfn "$PREV_TARGET" "$tmp" && as_root mv -Tf "$tmp" "$CURRENT_LINK"
  else
    log "no previous release to restore (nothing to roll back to)"
  fi
  if [ "$SKIP_RESTART" != "1" ]; then
    as_root systemctl restart "$UNIT"
    health_check || log "WARNING: service still unhealthy after rollback"
  fi
}

on_error() {
  local rc="$1" line="$2"
  log "step failed at line $line (exit $rc)"
  if [ "$ACTIVATED" = "1" ]; then
    rollback
  fi
  exit "$rc"
}
trap 'on_error $LINENO' ERR

health_check() {
  log "health-check $HEALTH_URL"
  curl --fail --silent --show-error \
    --retry 15 --retry-delay 2 \
    --retry-connrefused --retry-all-errors \
    --max-time 10 \
    -o /dev/null "$HEALTH_URL"
}

# ── 1. check out the release ───────────────────────────────────────────────
RELEASE_DIR="${RELEASES_DIR}/${SHA}"
if [ -d "${RELEASE_DIR}/.git" ]; then
  log "reusing existing checkout $RELEASE_DIR"
else
  if [ ! -d "$RELEASES_DIR" ]; then
    as_root mkdir -p "$RELEASES_DIR"
  fi
  if [ ! -w "$RELEASES_DIR" ]; then
    as_root chown "$(id -u):$(id -g)" "$RELEASES_DIR"
  fi
  log "cloning $SHA from $REPO_URL"
  rm -rf "$RELEASE_DIR"
  mkdir -p "$RELEASE_DIR"
  git -C "$RELEASE_DIR" init -q
  git -C "$RELEASE_DIR" remote add origin "$REPO_URL"
  if ! git -C "$RELEASE_DIR" fetch --quiet --depth 1 origin "$SHA" 2>/dev/null; then
    # Some servers refuse direct SHA fetches; fall back to the branch and walk
    # back to the commit. The depth is generous on purpose (SHAs land on main).
    log "direct SHA fetch refused; fetching $REF instead"
    git -C "$RELEASE_DIR" fetch --quiet --depth 500 origin \
      "+refs/heads/${REF}:refs/remotes/origin/${REF}" \
      || die "could not fetch $REF from $REPO_URL"
  fi
  git -C "$RELEASE_DIR" checkout --quiet --detach "$SHA" \
    || git -C "$RELEASE_DIR" checkout --quiet --detach FETCH_HEAD \
    || die "commit $SHA not found in $REPO_URL"
fi
[ -f "$RELEASE_DIR/package.json" ] || die "$RELEASE_DIR is not a checkout of hub"
log "checked out $(git -C "$RELEASE_DIR" rev-parse --short HEAD)"

# Carry runtime env across (not tracked by git, so a fresh checkout has none).
if [ -f "${CURRENT_LINK}/.env" ] && [ ! -f "${RELEASE_DIR}/.env" ]; then
  cp "${CURRENT_LINK}/.env" "${RELEASE_DIR}/.env"
  log "copied .env from current release"
fi

# ── 2. install + build ─────────────────────────────────────────────────────
# NODE_ENV must NOT be production here: pnpm would then skip devDependencies
# (typescript, tailwind, biome) and `next build` would fail.
(
  cd "$RELEASE_DIR"
  unset NODE_ENV
  log "pnpm install --frozen-lockfile"
  $PNPM install --frozen-lockfile
  log "pnpm build"
  $PNPM run build
)
[ -d "$RELEASE_DIR/.next" ] || die "build produced no .next output"

# ── 3. activate ────────────────────────────────────────────────────────────
log "activating $RELEASE_DIR"
NEW_LINK="${CURRENT_LINK}.new.$$"
as_root ln -sfn "$RELEASE_DIR" "$NEW_LINK"
if [ -L "$CURRENT_LINK" ]; then
  as_root mv -Tf "$NEW_LINK" "$CURRENT_LINK"   # atomic rename(2)
elif [ -e "$CURRENT_LINK" ]; then
  as_root mv "$CURRENT_LINK" "$PREV_DIR"       # directory -> symlink, first run
  if ! as_root mv -Tf "$NEW_LINK" "$CURRENT_LINK"; then
    as_root mv "$PREV_DIR" "$CURRENT_LINK"
    die "could not activate $RELEASE_DIR"
  fi
else
  as_root mv -Tf "$NEW_LINK" "$CURRENT_LINK"
fi
[ -e "${CURRENT_LINK}/package.json" ] || die "$CURRENT_LINK does not point at a release"
ACTIVATED=1

# ── 4. restart ─────────────────────────────────────────────────────────────
if [ "$SKIP_RESTART" = "1" ]; then
  log "SKIP_RESTART=1 — not restarting $UNIT"
else
  log "restarting $UNIT"
  as_root systemctl restart "$UNIT"
fi

# ── 5. health check ────────────────────────────────────────────────────────
if health_check; then
  ACTIVATED=0
  log "healthy — deploy of ${SHA:0:7} complete"
else
  # `die` below would skip the ERR trap (plain exit), so roll back explicitly.
  rollback
  die "health check failed after deploying ${SHA:0:7}"
fi

# ── 6. prune old releases ──────────────────────────────────────────────────
active_target="$(readlink "$CURRENT_LINK")"
kept=0
while IFS= read -r dir; do
  [ -n "$dir" ] || continue
  [ "$dir" = "$active_target" ] && continue
  [ "$dir" = "$RELEASE_DIR" ] && continue
  [ "$dir" = "$PREV_DIR" ] && continue
  kept=$((kept + 1))
  if [ "$kept" -gt "$KEEP_RELEASES" ]; then
    log "pruning old release $(basename "$dir")"
    as_root rm -rf "$dir"
  fi
done < <(ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null || true)

log "done: $CURRENT_LINK -> $active_target"
