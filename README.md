# asepharyana-hub-hub

Personal portfolio SPA — backend/infrastructure projects and live monitoring dashboard.

Built with **Next.js 16**, **shadcn/ui** (base-nova), **Tailwind CSS v4**, and `next-themes`.

## Stack

- **Framework:** Next.js 16 (Turbopack, React Compiler)
- **UI:** shadcn/ui v4 (base-nova style) + Tailwind CSS v4
- **Font:** Geist (sans) + Geist Mono via `next/font`
- **Theme:** `next-themes` — light/dark with amber "server LED" focus glow (dark mode)
- **Icons:** Lucide React
- **Linting:** Biome

## Pages

| Route | Description |
|-------|-------------|
| `/` | Portfolio landing page — hero, about, skills, featured project (ZeaVis Edu), infra CTA |
| `/dashboard` | Live infrastructure monitor — Docker services, Traefik metrics, Jaeger traces, Prometheus resources |

## Theme

Twilight Terminal — warm off-white (light) / deep indigo-slate (dark) with amber-gold primary in dark mode. All component styling is driven by CSS custom properties in `globals.css`.

## Dev

Requires **Node >= 22.12** and **pnpm 10.33.2** (pinned via `packageManager`).

```bash
pnpm install         # Install dependencies (pnpm-lock.yaml)
pnpm dev             # Start dev server
pnpm run lint        # Biome lint
pnpm run typecheck   # tsc --noEmit
pnpm run build       # Production build (next build)
pnpm start           # Serve the production build
```

## Deploy

`main` pushes run `.github/workflows/deploy.yml`: a pnpm build/typecheck job,
then a deploy job that scps `scripts/deploy-direct.sh` to the VPS over SSH. The
script checks the SHA out under `/opt/hub/releases/<sha>`, runs
`pnpm install --frozen-lockfile && pnpm build`, flips the `/opt/hub/current`
symlink, restarts the `hub` systemd unit and health-checks `http://127.0.0.1:4003/`,
rolling back to the previous release if it fails.

Secrets used: `VPS_HOST`, `VPS_USER`, `SSH_PRIVATE_KEY`.
