# syntax=docker/dockerfile:1

# Production image for `hub` (Next.js 16, pnpm 10).
#
# Entrypoint mirrors scripts/deploy-direct.sh + package.json "start":
#     next start -p $PORT
# so the container serves exactly what the systemd unit serves.
#
# Base is Debian slim rather than Alpine on purpose: `next` depends on
# sharp (@img/sharp-linux-x64), whose prebuilt native binding links
# against glibc. Musl/Alpine has no matching prebuild, so sharp would
# either compile from source (needs python3/make/g++ in the image) or
# silently drop the image optimizer.

ARG NODE_IMAGE=node:22-slim

# ── base: shared toolchain, pnpm via corepack ─────────────────────────────
FROM ${NODE_IMAGE} AS base
# COREPACK_ENABLE_DOWNLOAD_PROMPT=0 keeps `corepack enable` non-interactive
# in CI/buildkit builds that have no TTY. The pnpm version itself is pinned
# by "packageManager": "pnpm@10.33.2" in package.json.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    COREPACK_ENABLE_STRICT=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
WORKDIR /app
RUN corepack enable

# ── deps: full dependency tree (needs devDependencies for `next build`) ────
FROM base AS deps
# NODE_ENV is deliberately left unset in this stage and every stage that
# builds. pnpm skips devDependencies when NODE_ENV=production, which
# would drop typescript/tailwind and break `next build`. This is the same
# trap scripts/deploy-direct.sh guards against with `unset NODE_ENV`.
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# ── builder: produce .next ────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# ── prod-deps: runtime-only dependency tree ───────────────────────────────
FROM base AS prod-deps
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod && pnpm store prune

# ── runner: minimal non-root runtime ─────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=4003
WORKDIR /app

# `node` (uid/gid 1000) ships with the official images.
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=builder  /app/.next        ./.next
COPY --chown=node:node --from=builder  /app/public       ./public
COPY --chown=node:node --from=builder  /app/package.json         ./package.json
COPY --chown=node:node --from=builder  /app/next.config.ts      ./next.config.ts

USER node
EXPOSE 4003

# Port is hardcoded deliberately. In `HEALTHCHECK CMD` the string is
# evaluated by /bin/sh, so ${PORT} would be POSIX parameter expansion —
# and in the shellform the variable is not even guaranteed to be exported
# into the healthcheck environment. A literal is unambiguous.
#
# Uses node's built-in fetch rather than curl: node:22-slim has no curl,
# and adding one just for this would grow the attack surface.
#
# next.config.ts keeps images.maximumDiskCacheSize: 0 and
# experimental.isrFlushToDisk: false. Those existed because the Nix store
# was read-only at runtime; inside this image /app is writable, so they are
# no longer strictly required — but they are harmless and keep container
# and VPS/Nix behaviour identical, so the config is left untouched.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4003/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Runs `next start` directly rather than through pnpm/corepack.
# Two reasons:
#   1. The runner stage inherits from the base image, not the `base` stage
#      where `corepack enable` runs, so there is no pnpm shim here.
#      Depending on pnpm at runtime would mean re-installing a package
#      manager just to exec a binary that already sits in node_modules/.bin.
#   2. It removes corepack as a runtime dependency entirely — the
#      packageManager pin still governs the build, which is where pnpm
#      actually matters.
# The `-H 0.0.0.0` bind is required: next defaults to localhost-only,
# which is unreachable from outside the container.
CMD ["node_modules/.bin/next", "start", "-p", "4003", "-H", "0.0.0.0"]
