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

# ca-certificates is REQUIRED, not a convenience. node:22-slim ships without
# /etc/ssl/certs/ca-certificates.crt, so anything that reaches the network over
# HTTPS during the build fails with an error naming neither the base image nor the
# missing package:
#   Error: plugin::http_client::create_failed
#     × Failed to create HTTP client.
#     ╰─▶ unexpected error: No CA certificates were loaded from the system
# It surfaced from `pnpm run build` (moon run :build resolves task dependencies
# over HTTPS) and reads like a buildx or network fault. A local build can pass on
# cached layers and never hit it — this only failed in CI, on a cold cache, where
# the fetch is real. Verify Dockerfile changes with --no-cache.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

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
# Every workspace member's manifest is REQUIRED before installing. pnpm resolves
# the workspace from these, and apps/*/package.json were missing, so the install
# produced a root tree containing no apps at all. A later `COPY . .` does not
# repair it — the manifests are inputs to the install itself — and the symptom
# surfaces two stages away as
#   WARN  Local package.json exists, but node_modules missing, did you mean to install?
#   web:build | ELIFECYCLE  Command failed.
# which names the app and never the manifest that was missing.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json  apps/api/
COPY apps/web/package.json  apps/web/
RUN pnpm install --frozen-lockfile --config.node-linker=hoisted

# ── builder: produce .next ────────────────────────────────────────────────
FROM base AS builder
# pnpm's default linker fills node_modules with symlinks into
# /app/node_modules/.pnpm, so copying the tree without the store leaves every link
# dangling. The apps then fail with the least informative message possible:
#   WARN  Local package.json exists, but node_modules missing, did you mean to install?
# which is true and useless — the packages ARE installed, they are just
# unreachable. `--config.node-linker=hoisted` gives real directories instead and
# is the whole fix; see the install step above.
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# ── prod-deps: runtime-only dependency tree ───────────────────────────────
FROM base AS prod-deps
ENV NODE_ENV=production
# Same manifest set as the deps stage, and for the same reason: this install
# resolves the workspace too, so omitting apps/*/package.json here produces a
# runtime tree with no application in it. It fails later, as a 404 or a crash on
# the first request, rather than at build time.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json  apps/api/
COPY apps/web/package.json  apps/web/
RUN pnpm install --frozen-lockfile --prod --config.node-linker=hoisted && pnpm store prune

# ── runner: minimal non-root runtime ─────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=4003
WORKDIR /app

# WEB_DIST_PATH points the API at the built SPA, which it serves itself. Without
# it every browser route 503s, which is a confusing way to learn that. It is an
# absolute path into /app because the SPA is a separate app from the API, not
# something Next embeds.
ENV WEB_DIST_PATH=/app/web

# `node` (uid/gid 1000) ships with the official images.
#
# The tree is flat rather than pnpm's symlink farm because the install above used
# --config.node-linker=hoisted; copying one without the other leaves dangling
# links and every app reports "node_modules missing" while plainly being there.
COPY --chown=node:node --from=prod-deps /app/node_modules        ./node_modules
COPY --chown=node:node --from=builder     /app/apps/api/dist      ./dist
COPY --chown=node:node --from=builder     /app/apps/web/dist      ./web
COPY --chown=node:node --from=builder     /app/package.json       ./package.json

# The api's own manifests, because its dist resolves them through node_modules.
COPY --chown=node:node --from=builder     /app/apps/api/package.json ./apps/api/package.json

USER node
EXPOSE 4003

# Port is hardcoded deliberately. In `HEALTHCHECK CMD` the string is
# evaluated by /bin/sh, so ${PORT} would be POSIX parameter expansion — and in
# the shellform the variable is not even guaranteed to be exported into the
# healthcheck environment. A literal is unambiguous.
#
# Uses node's built-in fetch rather than curl: node:22-slim has no curl, and
# adding one just for this would grow the attack surface.
#
# /healthz, NOT /health. The SPA fallback mounts on the notFound handler and
# answers ANY unmatched path with index.html, so /health returns 200 with HTML
# and a healthcheck against it passes against a completely broken API — the
# strongest possible false positive. /healthz is a real API route.
#
# `r.ok` alone is still too weak here: any 2xx counts, and a redirect to the
# SPA would pass. Requiring the JSON shape makes the probe assert something.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4003/healthz').then(r=>r.ok&&r.headers.get('content-type')?.includes('json')?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

# node directly rather than through pnpm/corepack. Two reasons:
#   1. The runner stage inherits from the base image, not the `base` stage where
#      `corepack enable` runs, so there is no pnpm shim here. Depending on pnpm
#      at runtime would mean shipping a package manager just to exec a binary
#      already in node_modules.
#   2. It removes corepack as a runtime dependency entirely — the packageManager
#      pin still governs the build, which is where pnpm actually matters.
CMD ["node", "dist/main.js"]
