# hub

Personal portfolio SPA and live infrastructure monitor.

A **pnpm + [moon](https://moonrepo.dev) monorepo**: a Hono/oRPC API that scrapes
systemd and Prometheus, and a Vite + React SPA that renders it.

## Stack

| Layer | Tech |
|---|---|
| Monorepo | moon 2.6 + pnpm 10 workspaces |
| API | Hono 4 + oRPC 1.15 (`RPCHandler`), Zod-validated env, pino |
| Web | React 19 + TanStack Router (file-based) + Vite 8 + Tailwind v4 |
| Data | TanStack Query over the oRPC client |
| Lint | Biome (2-space indent, double quotes) |

No database, no auth, no multi-tenancy — the dashboard is read-only and the
portfolio is public, so none of that machinery has anything to do here.

## Layout

```
apps/api/     Hono + oRPC, hexagonal (domain → application → infrastructure → presentation)
apps/web/     Vite SPA (TanStack Router, src/routes/)
deploy/       hub.service — the systemd unit the VPS runs
scripts/      deploy-direct.sh — clone → build → symlink flip → restart → health-check
```

The API is split so the domain layer has **no framework imports**: it can be
unit-tested without Node, Hono, or a database. `apps/web` imports types only
from `apps/api`, never runtime code.

## Pages

| Route | Description |
|---|---|
| `/` | Portfolio landing — hero, about, skills, featured project (ZeaVis Edu) |
| `/dashboard` | Live infrastructure monitor — systemd services, Prometheus metrics |

Both poll `dashboard.getOverview` every 15 s through one shared TanStack Query
key, so the header and the dashboard are served by a single request.

## Dev

Requires **Node >= 22.12** and **pnpm 10.33.2** (pinned via `packageManager`).

```bash
pnpm install
pnpm dev          # moon runs api + web together
```

- API: <http://localhost:4003> (health: `/healthz`, RPC: `/rpc/*`)
- Web: <http://localhost:5173> — Vite proxies `/rpc` to the API, so the browser
  stays same-origin and no CORS setup is needed.

```bash
pnpm run typecheck   # tsc --noEmit in both apps
pnpm run lint        # biome check
pnpm run build       # moon run :build -> apps/{api,web}/dist
```

## Deploy

`main` pushes run `.github/workflows/deploy.yml`: a pnpm build/typecheck/lint
job, then a deploy job that scps `scripts/deploy-direct.sh` to the VPS over SSH.
The script checks the SHA out under `/opt/hub/releases/<sha>`, runs
`pnpm install --frozen-lockfile && pnpm build`, asserts both build outputs
exist, flips the `/opt/hub/current` symlink, restarts the `hub` systemd unit and
health-checks `http://127.0.0.1:4003/`, rolling back to the previous release if
it fails.

Hono serves **both** the API and the built SPA on port 4003, so there is one
process and no CORS.

The probe is `GET /` — deliberately **not** `/healthz`. `/healthz` answers 200
whenever `WEB_DIST_PATH` is unset, so probing it would let a release with a
missing `.env` pass; `/` answers 503 in that case, which is the signal you want.

### VPS setup

The unit must exist on the host and is versioned at `deploy/hub.service`:

```bash
sudo cp deploy/hub.service /etc/systemd/system/hub.service
sudo systemctl daemon-reload && sudo systemctl enable --now hub
```

`WEB_DIST_PATH` must point at the built SPA (`apps/web/dist`, resolved through
the `current` symlink). If it is set but missing, `/` answers **503** rather
than 200, so a broken release fails the deploy health check instead of shipping
a blank page. The deploy script also preflights the unit's `ExecStart` and
aborts before activating anything if it is still on the old command.

Secrets used: `VPS_HOST`, `VPS_USER`, `SSH_PRIVATE_KEY`.

## Env

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `4003` | |
| `PROMETHEUS_URL` | `http://127.0.0.1:9090` | |
| `BASE_DOMAIN` | `asepharyana.my.id` | used to build service links |
| `WEB_DIST_PATH` | — | set in production; omit for API-only |
| `VITE_API_URL` | — | only when the SPA and API are on different origins |