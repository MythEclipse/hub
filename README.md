# hub

Personal portfolio SPA and live infrastructure monitor.

A **pnpm + [moon](https://moonrepo.dev) monorepo**: a Hono/oRPC API that scrapes
systemd and Prometheus, and a Vite + React SPA that renders it.

## Stack

| Layer    | Tech                                                           |
| -------- | -------------------------------------------------------------- |
| Monorepo | moon 2.6 + pnpm 10 workspaces                                  |
| API      | Hono 4 + oRPC 1.15 (`RPCHandler`), Zod-validated env, pino     |
| Web      | React 19 + TanStack Router (file-based) + Vite 8 + Tailwind v4 |
| Data     | TanStack Query over the oRPC client                            |
| Lint     | Biome (2-space indent, double quotes)                          |

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

| Route        | Description                                                        |
| ------------ | ------------------------------------------------------------------ |
| `/`          | Portfolio landing — hero, about, skills, project catalogue         |
| `/dashboard` | Live infrastructure monitor — systemd services, Prometheus metrics |

The project catalogue is static data in `apps/web/src/lib/projects.ts` and is
rendered by `components/portfolio/project-card.tsx`. Every entry is a project
that exists in a repo under `github.com/asepharyana`, and every `Live` link was
checked against its hostname. A claim the repository contradicts is a bug in
that file — `projects.test.ts` guards the structural invariants (no duplicate
names, https-only links, no empty fields), but nothing can check prose against
the code it describes; that is a review responsibility.

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

| Variable         | Default                 | Notes                                              |
| ---------------- | ----------------------- | -------------------------------------------------- |
| `PORT`           | `4003`                  |                                                    |
| `PROMETHEUS_URL` | `http://127.0.0.1:9090` |                                                    |
| `WEB_DIST_PATH`  | —                       | set in production; omit for API-only               |
| `VITE_API_URL`   | —                       | only when the SPA and API are on different origins |

Service links need no configuration. The hostname is usually not the unit name
(`pr-agent-server` is served at `pr-agent`), so it is not composed from a base
domain: it is read from Caddy's live config and joined to the unit on the port
behind it. A hostname is only offered when `ss` shows that port accepting, so a
retired site drops off the dashboard on its own.

The one manual file is `/etc/hub/unit-ports.conf` (`unit=port`), covering units
whose port `bws-exec` injects from Bitwarden at exec time and which therefore
exists nowhere on disk. Everything else is read live.

## Releases and container images

Every push to `main` is analysed by [semantic-release](https://semantic-release.gitbook.io/).
The commit prefix decides the version bump — nobody types a version number:

| Commit                                             | Result                           |
| -------------------------------------------------- | -------------------------------- |
| `feat(scope): …`                                   | minor bump                       |
| `fix(scope): …`                                    | patch bump                       |
| `BREAKING CHANGE:` in the footer                   | major bump                       |
| `chore`, `ci`, `docs`, `refactor`, `test`, `build` | patch bump, or no release at all |

A release publishes a tag, a GitHub Release and the changelog. The same workflow
then builds and pushes one container image per service to GHCR at exactly that
version, so an image tag always matches a git tag:

This repo publishes 1 image(s):

| Package | Image                                   |
| ------- | --------------------------------------- |
| `hub`   | `ghcr.io/asepharyana/hub:hub:<version>` |


Pull one without touching the registry UI:

```bash
docker pull ghcr.io/asepharyana/<repo>:<service>:<version>
```

### Adding or removing an image

Do not edit `.github/workflows/release.yml` to change which images are built.
The list lives in `.github/docker-images.json`:

```json
{ "images": [{ "package": "<service>", "context": ".", "file": "Dockerfile" }] }
```

- `package` becomes the GHCR path component, so it must be lowercase
  `[a-z0-9._-]`. It does not have to match the repo name.
- `context` is the build context directory, `file` the Dockerfile within it.
- `build_args` is an object of `KEY=value` pairs; the pipeline flattens it before
  the matrix, so both the object and a pre-joined `"A=1\nB=2"` string work.
- `"enabled": false` keeps an entry documented but skips building it. **An empty
  or fully disabled list fails the run** rather than publishing nothing.

Every enabled entry must have a `Dockerfile` **and** a `.dockerignore` in its
context, and both must be tracked by git — CI cannot see an untracked file, and a
missing `.dockerignore` silently ships `node_modules/` and `.git` inside the image.

`latest` tracks the newest stable release. Prereleases (`1.2.0-rc.1`) are
tagged but never promote `latest`.

### If a release fails

Check the run, then fix forward with a normal commit — do not re-tag by hand:

```bash
gh run list --workflow=release.yml --limit 5
gh run view <run-id> --log-failed
```

A run that only built images and published no tag is normal for a `chore` push:
there was nothing to release, so no version was derived and no image was tagged.
