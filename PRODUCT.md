# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The portfolio (`/`) is read by recruiters and engineering managers evaluating
the owner as a candidate. They arrive from a search result or a link in an
application, know nothing about him, and are deciding whether to spend their
own time on a call. They are not developers reading his code — they are
scanning for evidence that the claims are true, and they abandon quickly.

The dashboard (`/dashboard`) has a different reader: the owner himself, and
occasionally a visitor who followed a link from the portfolio. It answers "is
the box up right now", not "who is this person".

A secondary audience is peer developers who land on a project link from GitHub
and want to see the code in context.

## Product Purpose

A single deployable that is both a job-seeking portfolio and a live monitor of
the production VPS it is served from. It exists so the portfolio is backed by
infrastructure the owner can point at: the site is not a claim about running
production systems, it is one of the running systems, reading its own systemd
units and Prometheus endpoint.

Success is measured in recruiter action — an interview, a reply, a hire
conversation. Not traffic, not page views, not engagement.

## Positioning

Every project listed is one the owner built, deployed and still operates, and
every `Live` link resolves against its real hostname. The dashboard on the same
origin is itself the proof: the claim "I run production infrastructure" is not
asserted, it is rendered from `systemctl` on the box serving the page. A
neighbouring portfolio cannot truthfully copy this, because it would require
thirty deployed services and a public monitor.

The differentiator is falsifiability. The site is designed so a visitor can
check any claim against a running system in one click.

## Operating Context

- One pnpm + moon monorepo. `apps/api` (Hono + oRPC, hexagonal) scrapes systemd
  and Prometheus; `apps/web` (Vite + React 19 + TanStack Router) renders it.
  `apps/web` imports types only from `apps/api`.
- In production Hono serves both the API and the built SPA on port 4003 —
  one process, no CORS. Caddy publishes it at `hub.asepharyana.my.id` and
  `asepharyana.my.id`.
- Deploy: push to `main` → GitHub Actions builds, then SSHes
  `scripts/deploy-direct.sh` to the VPS, which checks out the SHA under
  `/opt/hub/releases/<sha>`, builds, flips the `current` symlink, restarts the
  `hub` systemd unit and health-checks. Rollback on failure.
- The monitored host is `host1760805970`. Nothing about the service list is
  written in source: units are read from `/etc/systemd/system`, state from
  `systemctl show`, hostnames from Caddy's live admin API joined on port, and a
  hostname is only linked when `ss` shows its upstream accepting. A hand-kept
  list outlives what it names — `hermyhq` stayed on the dashboard for weeks
  after the app was deleted, because its unit file outlived the app too.
- A unit is dropped when its `ExecStart` program is gone (`ENOENT`). `EACCES`
  is deliberately not a signal: this process runs as `hub`, and most programs
  are root-owned, so a plain existence check would hide healthy services.
- Ports for `bws-exec` units are the one exception, listed in
  `/etc/hub/unit-ports.conf`, because the value is injected from Bitwarden at
  exec time and exists nowhere on disk.
- Local dev: `pnpm dev` runs api (:4003) and web (:5173) together; Vite proxies
  `/rpc` so the browser stays same-origin.
- Data refresh: both routes poll `dashboard.getOverview` every 15 s on one
  shared TanStack Query key, so the header and the dashboard cost one request.

## Capabilities and Constraints

- Read-only by design. No database, no auth, no accounts, no multi-tenancy.
  The dashboard observes; it cannot act.
- Prometheus failures surface as `null`, never `0`, and the UI renders an
  explicit no-data state — a fake "0% CPU" during an outage is a defect, not a
  fallback.
- No contact channel currently exists on the page. **Required (confirmed, not
  yet built): a visible email address with a `mailto:` link, a LinkedIn link,
  and the existing GitHub link.** No downloadable resume/CV was chosen.
- **Required (confirmed, not yet built): a full bilingual id/en switch.** The
  portfolio copy is currently English with Indonesian proper nouns
  ("Teknik Informatika", "Pijak × IBM SkillsBuild") under `<html lang="en">`.
  Both languages must be first-class, not a machine-translated afterthought.
- No analytics, no tracking pixels, no third-party scripts of any kind.
- No image generation is available in this project's toolchain.
- The project catalogue is static data (`apps/web/src/lib/projects.ts`). Prose in
  it cannot be verified against the code it describes — that is a review
  responsibility, and `projects.test.ts` guards only structural invariants.
- Service links are not configurable by environment variable.

## Brand Commitments

- The public name **"Asep Haryana Saputra"** and its current voice are binding.
  The portfolio is written in the first person, states mechanisms rather than
  adjectives, and does not hedge: no "passionate about", no "passionate
  developer". Technical specificity *is* the voice.
- The owner presents as Indonesian (Teknik Informatika student) and the copy
  reflects that; bilingual support is a commitment, not an experiment.
- The live infrastructure is intentionally visible proof, not hidden
  infrastructure. The dashboard is part of the pitch.

## Evidence on Hand

- Six real, deployed projects with verified live hostnames and GitHub sources
  in `apps/web/src/lib/projects.ts` — the product's strongest asset.
- 29 monitored systemd units and a Prometheus endpoint, rendered live.
- All project images/hostnames are reachable at time of writing.
- **Absent — must not be fabricated:** no testimonials, no client logos, no
  named employers, no user counts, no performance benchmarks, no pricing, no
  star counts, no "used by N developers". There is no CV PDF. There is no
  photography. The only image asset in the repo is `favicon.ico`.
- `email` and `LinkedIn` **URLs/addresses are not yet supplied** — the channels
  are confirmed as requirements, the values are an open decision and must be
  given by the owner before any contact UI is built. Do not guess or derive
  them from git metadata.

## Product Principles

1. **Falsifiable over impressive.** Every claim is a link a visitor can click
   or a metric they can read. If a statement cannot be checked against a real
   system, it does not belong on the page.
2. **Mechanism over adjective.** "Diff is budgeted before it is prompted" earns
   trust; "robust engineering practices" spends it. Specificity is the
   persuasion strategy.
3. **One action, never two.** The page exists to produce a recruiter reply.
   Every element competes for the same attention budget as the contact path.
4. **The monitor is the proof, not a side feature.** The dashboard is not a
   toy. It reads real systemd state and must never fake or default a healthy
   reading.
5. **Bilingual is first-class.** Indonesian is the owner's native professional
   language and where he works; it is not a translation of the English.
6. **Read-only means read-only.** No auth, no tracking, no outbound data. This
   is a property the visitor can verify in the network tab, and that
   verifiability is part of the product.

## Accessibility & Inclusion

No product-specific standard has been established. The incumbent implementation
carries a `prefers-reduced-motion` block, `:focus-visible` rings in both themes,
`aria-label` on icon-only controls, and semantic headings — these are existing
obligations to preserve, not an established target. Audience facts that are
confirmed: readers are non-native English speakers evaluating an engineering
claim, which makes legibility of technical copy a functional requirement rather
than a nicety.