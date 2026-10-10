# TODO

Follow-up work from the Next.js → monorepo migration (Hono/oRPC + Vite/TanStack
Router). Everything below was verified against the current tree; each item cites
the file or command that proves it.

Nothing here is committed yet — the migration itself is still an uncommitted
working-tree changeset.

---

## Blockers — do these before the next deploy

### 0a. Production ships full sourcemaps — your TypeScript source is public

`vite.config.ts:34` and `tsup.config.ts:13` both set `sourcemap: true`, and the
static handler serves `apps/web/dist` with no restriction. Verified against the
running build:

```
GET /assets/dashboard-DojbRnuU.js.map -> HTTP 200, 48415 bytes
sources: ['../../src/components/dashboard/no-data.tsx', ...]
embedded source files: 6
--- sample ---
 "use client";
```

`apps/web/dist/assets/*.map` totals **2.7 MB** — roughly 5× the ~540 KB JS
bundle — and `sourcesContent` embeds the original, `#/`-aliased TypeScript.

**This is a regression.** The old `next.config.ts` never set
`productionBrowserSourceMaps`, so Next did not serve them.

Fix (any one): set `sourcemap: false` in `vite.config.ts`, or refuse `.map`
requests in the static handler, or strip `*.map` as a build step. Note
`contentTypeFor` also has no `.map` branch, so they are currently served as
`application/octet-stream`.

### 0b. A missing hashed asset returns `200 text/html` instead of 404

`main.ts:119` registers `app.get("*")` → `index.html`, and it also swallows
`/assets/*`. Verified:

```
GET /assets/NOPE.js -> HTTP 200  type=text/html
```

So after a deploy, a browser requesting a stale hashed chunk gets HTML with a
200 and fails with a MIME error instead of a clean 404. **The deploy health
check cannot catch this** — it probes only `/`, and the release assertions only
check that `index.html` and `main.js` exist. A release whose HTML references a
missing chunk deploys green and breaks in every browser.

Exclude `/assets/*` from the SPA catch-all. The same one-line change also fixes
the `/rpc/*` GET fallthrough in item 9.

### 0. Check `git status` before committing — the index is out of sync

The changeset is **staged**, and one entry was in a misleading state: when
`apps/web/src/hooks/use-mobile.ts` was deleted from the working tree, git still
had it staged as a rename from `src/hooks/use-mobile.ts`:

```
RD src/hooks/use-mobile.ts -> apps/web/src/hooks/use-mobile.ts
```

`R` = staged rename, `D` = deleted in worktree. Committing as-is would have
**added a dead file to the migration**. It has since been unstaged, so it now
shows as a plain `D`.

Lesson for the rest of this migration: the deletions were done with a mix of
`git rm` and plain `rm`, so **read `git status --short` carefully before
committing** — anything showing `RD` or `RM` is a file that is staged but no
longer on disk.

### 1. `typecheck` fails on a fresh clone (CI will fail)

`apps/web/src/routeTree.gen.ts` is generated **only** by the Vite `tanstackRouter`
plugin during `vite build`/`vite dev` — there is no postinstall, prepare or codegen
script in either package.json — and it is listed in `.gitignore` (line 28). So it
is absent from every fresh checkout, while `apps/web/src/router.tsx:3` imports it.

Verified — with the file removed:

```
$ mv src/routeTree.gen.ts /tmp/ && npx tsc --noEmit
src/router.tsx(3,27): error TS2307: Cannot find module './routeTree.gen'
src/routes/dashboard.tsx(41,38): error TS2345:
  Argument of type '"/dashboard"' is not assignable to parameter of type 'undefined'
```

The second error is the nastier one: without the generated tree the route
paths collapse to `undefined`, so **route typing silently degrades** rather than
just erroring.

`.github/workflows/deploy.yml` runs **Typecheck (line 41) before Build (line 44)**,
so the next CI run on a fresh checkout fails before it ever builds.

Pick one:
- **Commit `routeTree.gen.ts`** (remove it from `.gitignore`, keep the Biome
  exclude). Simplest, and CI then works unchanged.
- **Reorder CI** to Build → Typecheck. Cheapest diff, but leaves the file
  untracked so local `pnpm typecheck` still fails on a fresh clone.
- **Add a `prepare`/`postinstall` codegen** in `apps/web` so the tree is
  generated on install.

### 2. Install the systemd unit on the VPS

The unit lives only on the remote host, so the migration is incomplete until it
is updated. It must run `node apps/api/dist/main.js` (not `pnpm start`), with
`WorkingDirectory=/opt/hub/current`.

```bash
sudo cp deploy/hub.service /etc/systemd/system/hub.service
sudo systemctl daemon-reload
sudo systemctl enable --now hub
```

`scripts/deploy-direct.sh` preflights the unit's `ExecStart` and dies with
`ACTIVATED=0` (no symlink flip, no rollback) if it still points at the old
command — so this fails loudly rather than serving a stale release.

---

## Deploy / CI

### 3. Add a production `.env` to the VPS

`apps/api/src/infrastructure/config/env.ts` reads six vars. Only `WEB_DIST_PATH`
actually matters in production, and it is **not** in the repo
(`/opt/hub/current/.env` is gitignored). Without it the API serves RPC only and
every browser path answers **503**.

```bash
# /opt/hub/current/.env
WEB_DIST_PATH=/opt/hub/current/apps/web/dist
PORT=4003
PROMETHEUS_URL=http://127.0.0.1:9090
BASE_DOMAIN=asepharyana.my.id
NODE_ENV=production
```

Two details that matter:

- **Use the symlink path, never a pinned release path.** The deploy copies
  `.env` forward from the current release, but if `WEB_DIST_PATH` were pinned to
  something like `/opt/hub/releases/<sha>/apps/web/dist`, the atomic symlink flip
  would swap the code while leaving the SPA behind — serving new JS against old
  assets. `/opt/hub/current/...` resolves through the flip, so code and assets
  switch together.
- `PORT` is `z.coerce.number()` — quote-free is fine.

**No code loads `.env` — only systemd does.** `env.ts` reads `process.env`
directly; there is no `dotenv` dependency, and neither Hono nor
`@hono/node-server` loads `.env` (both verified absent). So the unit's
`EnvironmentFile=` line is what makes this work in production, and it means
**`pnpm dev` silently ignores a local `.env`** — anyone expecting it to apply
will debug phantom defaults. Either add `dotenv`/`process.loadEnvFile()` to
`main.ts`, or state in the README that `.env` is systemd-only.

### 3b. The API binds all interfaces with no security headers

`serve({ fetch: app.fetch, port })` passes no `hostname`, so it listens on
`0.0.0.0` (verified: `ss -tln` shows `*:4210`). Combined with the complete
absence of security headers (`grep` for `secureHeaders`, `CSP`,
`Strict-Transport-Security`, `X-Frame-Options` across `apps/`, `deploy/`,
`scripts/` → nothing), the API exposes a 22-unit systemd inventory, the
Prometheus URL, and static file reads on every interface.

Low severity in practice — Caddy fronts it in production and `WEB_DIST_PATH` is
operator-supplied — but the migration moved from `next start` (proxy-oriented)
to a bare Node listener without revisiting the posture. Consider binding
`127.0.0.1` and adding `hono/secure-headers`.

### 3c. No compression or cache headers on static assets

Verified response headers: a 280 KB JS chunk is served with **no
`content-encoding`** (Vite's own build log says gzip would make it ~89 KB) and
**no `cache-control`** — even though asset filenames are content-hashed and
should be `immutable`. Hono ships `compress()` and `hono/secure-headers`;
neither is used (`grep -c "compress\|Cache-Control\|secureHeaders"` on
`main.ts` → 0).

### 4. Dependabot: do **NOT** add per-package directories (verified upstream)

`pnpm-lock.yaml` has three importers (`.`, `apps/api`, `apps/web`), so it is
tempting to add a `directory:` entry per app. **Don't** — that is a known
pnpm-workspace bug and makes things worse.

[dependabot-core#10758](https://github.com/dependabot/dependabot-core/issues/10758)
was closed as completed with the maintainer's explicit guidance:

> "for a pnpm monorepo, you only want to tell dependabot about the root, not the
> packages within"

The failure modes reported there:

- **Root only** — on older versions, `apps/*/package.json` was ignored entirely.
  Fixed upstream in Dec 2024, so with a current Dependabot the existing
  `directory: "/"` **does** pick up the workspace packages and updates
  `pnpm-lock.yaml` correctly.
- **Root + per-package entries** — generates PRs for each package but **does not
  update `pnpm-lock.yaml` for the sub-packages**, i.e. broken lockfiles.

So the existing config is likely already correct. The action item is therefore
**verify, don't change**: after the migration lands, confirm Dependabot opens PRs
touching `apps/api/package.json` / `apps/web/package.json` *and* that those PRs
include an updated `pnpm-lock.yaml`. Only if step one fails is a config change
warranted — and per the above, adding directories is the wrong fix.

(The existing comment in `.github/dependabot.yml` about pnpm mapping to the `npm`
ecosystem stays valid.)

### 4b. Auto-merge will merge major bumps

`.github/dependabot-auto-merge.yml` runs `gh pr merge --auto --merge` for **every**
`dependabot[bot]` PR, with no version-type, label or path filter. But
`.github/dependabot.yml` groups only `minor` + `patch` — majors are deliberately
excluded from the groups, so they arrive as individual, **ungrouped** PRs that
still match the actor check and get auto-merged.

That is how the repo ended up on Next 16.3.5 / Biome 2.5.14 / React 19.3 while
the automation was nominally grouping only safe bumps. Gate the workflow on the
update type (e.g. only auto-merge when the PR carries the `minor`/`patch` group
label), or add `ignore` rules for majors you want to review by hand.

### 5. Dry-run the deploy before the first real one

```bash
SKIP_RESTART=1 RELEASES_DIR=/tmp/hub-rel CURRENT_LINK=/tmp/hub-cur \
  bash scripts/deploy-direct.sh "$(git rev-parse HEAD)" main
```

Exercises clone → install → build → asserts → symlink flip → prune, without
touching the real `/opt/hub` or restarting anything.

### 6. The deploy health check has no total-time bound

`health_check` passes `--max-time 10` together with `--retry 15 --retry-delay 2`.
curl's `--max-time` caps **each attempt**, not the whole sequence, so the worst
case is roughly `15 × (10 s + 2 s)` — about three minutes — not 10 s. A release
that never comes up therefore burns three minutes before rolling back.

If you want a real ceiling, wrap the call in `timeout` (e.g. `timeout 60 curl …`)
or track elapsed time in the retry loop.

### 7. The deploy script logs tool versions but never checks them

`deploy-direct.sh:76` prints `node`/`pnpm` versions and moves on. If the VPS runs
a Node older than the `>=22.12.0` in `engines`, the failure surfaces deep inside
`pnpm run build` (Vite 8 requires `^20.19.0 || >=22.12.0`) — after a full clone
and a full install, the most expensive possible place to find out. Add an explicit
version check next to the existing `command -v` guards, and state the required
versions in the README's *VPS setup* section (currently they appear only under
Dev).

---

## Reliability

### 8. Non-existent systemd units are reported as degraded services

`systemctl show <unit> -p ActiveState -p LoadState` **exits 0 for a unit that
does not exist**, printing `LoadState=not-found` / `ActiveState=inactive`. So the
`try/catch` in `systemd-inspector.ts` never fires, and the parser at the
`ActiveState=` regex **discards the `LoadState` that distinguishes "broken" from
"not installed here"**.

Consequence: every unit missing on the current host is reported as
`{state: "inactive"}` and counted as degraded — inflating the "N degraded" badge
and skewing the health donut. (The original Next.js route had the same defect;
the migration preserved it rather than introducing it.)

Fix: request and check `LoadState`, and skip units where it is `not-found`
instead of counting them.

### 9. `GET /rpc/*` falls through to the SPA instead of 404ing

The RPC middleware ends with `return next()`, so an unmatched path continues into
the SPA catch-all. Measured:

```
POST /rpc/nonexistent/thing      -> 404 text/plain   ✓ correct
GET  /rpc/bogus                  -> 200 text/html    ✗ wrong
GET  /rpc   and   GET /rpc/      -> 200 text/html    ✗ wrong
```

**Lower impact than it looks**: the oRPC client uses POST, and real procedures
answer correctly — so this is not breaking the app today. It is still wrong:
anything probing with GET (a monitor, a browser hitting `/rpc` directly, a
`curl` in a health check) gets HTML with a 200 and cannot tell the API is not
responding. Return a JSON 404 for unmatched `/rpc/*`.

### 10. `Sparkline` renders an invalid SVG path on single-sample data

`apps/web/src/components/dashboard/sparkline.tsx:71` divides by
`data.length - 1`. The `!data.length` guard on line 66 catches *empty* data but
not a **one-element** array, so `0 / 0` produces `NaN` inside the `d`
attribute. The line path is guarded (`data.length > 1`, line 105) but the
**area** path (line 94) is not.

Reproduced exactly:

```
2 samples : M45,135 L45.0,66.0 290.0,20.0 L290,135 Z
1 sample  : M45,135 LNaN,20.0 L290,135 Z     <-- invalid
```

The effect is a silently missing area fill, not a crash — which is why it
survived a smoke test. It is reachable in production: `prometheus-client.ts`
returns whatever Prometheus gives, and a range query can collapse to one bucket.

Fix: treat `data.length === 1` like the empty case (or clamp the divisor), and
cover it with a test (see item 14).

### 11. Network throughput silently drops one interface

`prometheus-client.ts` `query()` returns `result[0].value[1]` and discards every
other series — fine for single-series queries, but the two network queries in
`get-overview.ts` have **no aggregation wrapper**, so they match one series per
device. Verified on this host:

```
rate(node_network_receive_bytes_total{device!="lo"}[1m])
  eth0       = 26913.33
  tailscale0 =   2176.51     <-- dropped
```

So the reported `netIn`/`netOut` understate real traffic by the tailscale
amount. The `*_spark` companions already use `sum(...)` and are correct — only
the two instantaneous values are wrong. Wrap those two queries in `sum()`.

### 12. `systemctl` calls have no timeout and run sequentially

`apps/api/src/infrastructure/systemd/systemd-inspector.ts` spawns one
`execFile("systemctl", …)` **per unit, in a serial loop**, with no `timeout`
option. Prometheus has `AbortSignal.timeout(5000)`; systemd has nothing.

Measured cost today is ~175 ms for the loop and ~220–310 ms for a full
`getOverview` (22 units + 18 PromQL queries), so this is not urgent — but a hung
D-Bus socket would stall the request indefinitely, with the 15 s client poll
piling up behind it.

Two fixes, both verified feasible:
- **Batch the units.** `systemctl show a.service b.service -p Id -p ActiveState`
  returns one blank-line-separated block per unit — 22 spawns become 1. **You
  must request `-p Id`**: without it the blocks carry only `ActiveState=` and
  cannot be mapped back to which unit they belong to. Verified:
  ```
  $ systemctl show caddy.service nats.service -p Id -p ActiveState
  Id=caddy.service
  ActiveState=active

  Id=nats.service
  ActiveState=inactive
  ```
  Note this changes the missing-unit behaviour too: a `not-found` unit still
  returns a block (with `LoadState=not-found`) rather than being silently
  skipped, so the parser has to handle that case explicitly.
- **Add `{ timeout: 2000 }`** to the `execFileAsync` call so a stuck call fails
  that unit instead of the request.

### 13. `decodeURIComponent` can throw and return 500

`apps/api/src/main.ts` calls `decodeURIComponent(new URL(c.req.url).pathname)`
with no `try/catch`. A malformed percent-escape (e.g. `/%zz`) throws `URIError`,
which propagates to `app.onError` and returns **500**. It is unauthenticated and
trivially reachable — a cheap way to fill the error log, and it turns a
`curl`-style probe into a scary 500 instead of a 404. Wrap it and return 404.

### 14. A failed API renders as an idle system, not an error

Neither `routes/dashboard.tsx:48` nor `components/dashboard/header.tsx:19`
destructures anything but `{ data }` — there is **no** `isError` / `isPending`
handling anywhere (verified: zero matches for all three).

With `retry: 1`, two failures leave `data` undefined and the page renders its
initial state permanently:

- the header badge reads **"No services"** — neutral, not an error state
- Overview shows `0` total / `0` healthy, and the donut renders nothing
- `gaugeColor(null)` returns **green**, so a total outage looks *healthy*

This is the app's most user-visible failure mode: an outage is indistinguishable
from an idle system. Add an `isError` branch to both components, and consider
making `gaugeColor(null)` a neutral grey — the green was deliberate, but it is
the wrong signal during an outage.

### 15. `hasNode` is true before data arrives

In `routes/dashboard.tsx`, `data?.node.cpu !== null` evaluates to
`undefined !== null` → **`true`** when `data` is undefined, so the "System
Resources" and "Load Average" cards render on first paint with all-null gauges
and an empty sparkline, then visibly pop when data lands. The adjacent
`hasTraffic` uses `?? 0` and gets this right. Use `!= null` (or `?? null`) for
consistency.

### 16. No caching on the overview payload

Every dashboard poll (per browser tab, every 15 s) re-runs all 22 systemctl
calls and 18 Prometheus queries. A 2–5 s memo in `makeGetOverview` would collapse
duplicate concurrent requests; the `Cache` port pattern from the skill is overkill
here, a module-level timestamp is enough.

---

## Tests

### 17. No tests, and the `test` task passes vacuously

There is no test runner and no `*.test.ts` anywhere — but both `apps/*/moon.yml`
files keep a `test` task hardcoded to `echo 'no tests configured'`. **That is the
worst failure mode: it returns green while executing nothing**, so it reads as
"coverage exists". (`pnpm test` at the root doesn't exist at all —
`ERR_PNPM_NO_SCRIPT`.)

Highest-value first targets, all pure functions of their deps:

| Target | Cases worth covering |
|---|---|
| `application/dashboard/get-overview.ts` | **`null` passthrough** — the file's own doc comment says failures must never become `0`, or an outage renders a fake "0% CPU". Nothing asserts that invariant. Plus link composition (`hasWeb && running` only), empty service list |
| `infrastructure/systemd/systemd-inspector.ts` | `active` → `running` mapping, missing unit skipped, `failed` state preserved |
| `presentation/orpc/error-mapping.ts` | the six `AppErrorCode` → status pairs; it is declared the single source of truth and nothing checks it. Note `notFound`/`internalError` currently have **zero call sites** — either exercise or delete them |
| `apps/web/src/lib/dashboard/format.ts` | `safeDur` boundaries (999 → `999µs`, 1000 → `1.0ms`, 1e6 → `1.00s`); `gaugeColor` at null/60/60.1/80 |
| `components/dashboard/sparkline.tsx` | the single-sample `NaN` case from item 6 |

**Cheapest runner: Node's built-in `node:test`.** Node 24 is already pinned
(`engines.node >=22.12`, CI uses 24), and `node --test` auto-discovers
`*.test.ts`, strips types natively, recurses, and skips `node_modules` — no
config file, no new dependency, no lockfile churn. `apps/api` needs zero setup
changes (its tsconfig already has `types: ["node"]`).

**Verified in this repo**, not assumed — a throwaway `src/probe.test.ts` calling
`makeGetOverview` with fake ports ran green:

```
$ node --test src/probe.test.ts
✔ proves node:test runs TS in this repo (1.81ms)
ℹ pass 1  ℹ fail 0
```

It also confirms the `null`-passthrough invariant holds today, so that test is
ready to keep rather than write from scratch.

Two gotchas if you extend this to the web app:
- `apps/web/tsconfig.json` pins `types: ["vite/client"]` (a closed list), so
  `import { test } from "node:test"` fails with TS2591 — add `@types/node` there.
- The `#/` alias is defined **only** in tsconfig paths and resolved **only** by
  the Vite plugin; there is no `imports` field in any `package.json`. Node's
  runner cannot resolve it, so web tests must import siblings relatively.

Finally, **add a test step to `deploy.yml`** (between Typecheck and Build).
Otherwise nothing runs the tests on the way to the VPS and a regression in
`get-overview` ships silently.

---

## Cleanup

### 18. moon build cache can serve a stale web bundle

`apps/web/moon.yml` declares the `build` task inputs as `src/**/*`,
`tsconfig.json`, `vite.config.ts`, `index.html`. Moon caching **is** active for
the project tasks (only the inherited `.moon/tasks.yml` tasks set `cache: false`),
so two classes of change are invisible to the hash:

- everything under `apps/web/public/` (Vite copies it verbatim into `dist/`)
- `apps/web/package.json` and `pnpm-lock.yaml`

Editing the favicon or bumping a dependency can therefore rebuild nothing and
leave the previous bundle in place. Add `public/**/*`, `package.json` and
`../../pnpm-lock.yaml` to the inputs.

**Reproduced, not theorised:**

```
$ printf 'x' >> apps/web/public/favicon.ico    # 25931 -> 25932 bytes
$ moon run web:build
▮▮▮▮ web:build (cached, 4ms, 7af7c3e6)         # no rebuild at all
$ stat -c %s apps/web/dist/favicon.ico
25931                                            # dist is stale
$ stat -c %s apps/web/public/favicon.ico
25932
```

A real favicon change would ship the *old* icon. The deploy script's
`apps/web/dist/index.html` assertion still passes, so nothing catches it.

### 19. Dead code left from the migration

All verified by grep — none are referenced:

- **`tw-animate-css`** — imported at `apps/web/src/styles.css:2` and listed in
  `apps/web/package.json`. It only provides `animate-in`, `fade-in-*`,
  `slide-in-from-*`, `zoom-in-*` utilities; **zero** surviving files use them as
  classes (they were all in the 58 deleted shadcn components). The one
  `fade-in-up` hit is the word inside a doc comment in `motion-primitives.tsx:19`,
  not a `className`. Drop both the import and the dependency.
- **`@tanstack/react-query-devtools`** — declared at
  `apps/web/package.json:31` and installed, but nothing imports it. Either wire
  it into `__root.tsx` behind a dev-only guard (it was on the original roadmap)
  or drop the dependency.
- **`dashboardKeys`** (`apps/web/src/libs/tanstack-query/keys.ts`) — never
  imported. Its comment claims the header and dashboard share one key, but that
  dedup is already produced by oRPC: both call sites use
  `orpc.dashboard.getOverview.queryOptions()`, which derives the key from the
  procedure path. The file is dead weight with a misleading comment — delete it.
- **Stale pnpm allowlists in root `package.json`** — `ignoreScripts`,
  `trustedDependencies` and `pnpm.onlyBuiltDependencies` all still name `sharp`
  and `unrs-resolver`. Both were Next.js-only transitive deps and now appear
  **0 times** in `pnpm-lock.yaml` (only `esbuild`, 187 mentions, survives).
  Trim all three lists to `esbuild`.
- **Unused animation tokens in `apps/web/src/styles.css`** — `animate-shimmer`,
  `animate-glow-pulse`, `animate-float`, `animate-breathe` and
  `animate-border-glow` have zero references anywhere, and the built stylesheet
  only emits the `@keyframes` they back if something applies them. Same for the
  `.glass`, `.glow-ring` and `.terminal-cursor` utilities (0 refs each).
  **Keep `animate-gradient-shift`** — it is applied by `.gradient-text`
  (`styles.css:214`), so it is load-bearing despite having no `.tsx` reference.
- **`biome.json` `linter.domains.next`** — keep it. Checked against the installed
  Biome 2.5.14 schema: `next` is still a valid `RuleDomainValue` and
  `biome check` reports no configuration warning. Harmless, and it keeps the
  ignore rule meaningful if a Next artifact ever reappears.
- **`.moon/tasks.yml`** — `check`, `lint` and `format` are defined but never
  resolvable: there is no root `moon.yml`, so `moon run :lint` reports *"No tasks
  found"*. They also still reference `@globs(sources)` / `@globs(tsconfig)`,
  file groups removed during the moon-config fixes.

  **This is not breaking anything** — root `package.json` calls `biome check`
  and `pnpm -r … typecheck` directly, so `pnpm run lint`/`typecheck`/`build`
  (what CI uses) all pass. It is dead config that will mislead the next person.
  Either add a root `moon.yml` so these attach to a project, or delete them.

- **`apps/web/src/lib/motion.ts`** — 17 of its 21 exported presets are unused
  (`fadeIn`, `fadeInDown/Left/Right`, `scaleIn`, `hoverLift`, `hoverGlow`,
  `drawPath`, `growWidth`, `tapScale`, `staggerFast`, `staggerSlow`, `spring`,
  `springBouncy`, `smoothEase`, `counterProps`, `duration`, …). Only
  `fadeInUp`, `scaleInSpring`, `stagger` and `springGentle` are imported.

  **Pre-existing, not caused by the migration** — flagging for honesty, not as
  new debt.

- **`motion-primitives.tsx`** — `AnimatedPresence`, `BlurReveal` and
  `InteractiveCard` are exported but never referenced. `AnimatedPresence` is
  doubly dead: it hand-rolls `exit` props but is never wrapped in a real
  `AnimatePresence`, so it would not even animate out.

### 20. `@types/node` is ahead of the Node the repo supports

`package.json` sets `engines.node: ">=22.12.0"` and CI runs Node 24, but both
apps resolve `@types/node@^26` (26.6.4 in the lockfile). A developer on the
minimum supported Node 22.12 type-checks against the **Node 26 API surface** and
can write code that compiles locally but fails on the VPS. Either pin
`@types/node` to `^24` to match CI, or raise `engines.node` to match the types.

### 21. Docs and config drift

Mostly fixed during this audit; the remainder:

- **README env table is incomplete.** `env.ts` validates six variables but the
  table lists four and omits `GITHUB_REPO_URL` and `NODE_ENV`.
- **README should not claim pnpm is pinned.** The `packageManager` field is
  real, but `deploy-direct.sh` resolves pnpm from `PATH` **first** and only falls
  back to corepack, so a host with a different pnpm wins silently.
- **Document the `#/` and `#api/` import aliases.** Every file under
  `apps/web/src` imports through `#/`, and `libs/orpc/client.ts` uses `#api/`.
  They exist only in `apps/web/tsconfig.json` — there is no `imports` field in
  any `package.json`, which is also why `node:test` cannot resolve them (item 14).
- **Next.js leftovers in ignore config.** `.gitignore` still lists `/.next/` and
  `/out/`, and `biome.json` still has `!.next` in `files.includes`. Nothing
  produces them any more.
- **Root `tsconfig.json` compiles an empty program** — its `include` is
  `["tsconfig.base.json", "*.ts"]` but there are no `.ts` files at the repo
  root, so `tsc --noEmit` there exits clean while checking nothing. Harmless
  (real typechecking happens per-app), but misleading.
- **Consider an agent-facing doc.** The old `AGENTS.md`/`CLAUDE.md` pointed at
  Next.js docs and were deleted; nothing replaces them, so the next agent starts
  with no map of the new stack.

### 22. `next-themes` in a non-Next app

`next-themes` is used in `__root.tsx` and `header.tsx`. It has **no Next.js
coupling** and works correctly here — the dark-mode toggle was verified working
in a real browser — so this is a naming oddity, not a defect. The anti-FOUC
script is inlined in `apps/web/index.html` because SSR no longer applies it.
Worth a comment so nobody "fixes" it by swapping the library.

---

## Fixed during this audit — already done, listed for the record

These were live defects found by the audit and **corrected in the working tree**
(verify with `git diff` before committing):

| Fix | Was |
|---|---|
| `apps/api/package.json` `main` + `start` | pointed at `dist/main.mjs`, which never existed — **`pnpm start` was broken**. Now `dist/main.js` |
| `apps/api/tsup.config.ts` comment | claimed output "lands in .mjs"; backwards, since `"type": "module"` makes tsup emit `.js` |
| `src/main.ts` dead `app.get("/")` | unreachable — the SPA catch-all already claims `/`. Removed |
| `env.ts` `GITHUB_REPO_URL` default | `.../asepharyana-hub` → `.../hub`; the wrong URL was rendering a dead GitHub link on the dashboard |
| `README.md` deploy section | claimed the script health-checks `/healthz`; it actually checks `/` |
| `apps/web/src/hooks/use-mobile.ts` | was staged-as-renamed but deleted from disk — would have been committed as dead code |

## Verified working — no action needed

Recorded so the next person doesn't re-check:

- `pnpm run typecheck`, `pnpm run lint`, `pnpm run build` all pass from the repo root.
- Both pages render with live data in a real browser (headless Chrome):
  22 systemd services, Prometheus gauges (CPU/RAM/disk), donut, sparklines,
  dark-mode toggle, **zero console errors**.
- Single-origin serving on one port: `/`, `/dashboard`, `/favicon.ico`,
  hashed assets and the SPA fallback all return 200 with correct content types;
  RPC answers on `/rpc/*` on the same port.
- Path traversal is blocked — `%2e%2e`-encoded attempts return 404.
- A missing/broken `WEB_DIST_PATH` returns **503**, so a broken release fails
  the deploy health check instead of shipping a blank page.
- `null` from Prometheus is preserved end-to-end, so an outage renders "no
  data" rather than a fake `0%`.
- **The build works in a stripped, non-TTY environment** (checked with `env -i`),
  so `moon` is safe to invoke over ssh from the deploy script.
- **`moon` resolves on the VPS without being globally installed**: it is a root
  devDependency (`@moonrepo/cli` 2.6.1, present in `pnpm-lock.yaml`), and
  `pnpm run build` puts `./node_modules/.bin/moon` on PATH — verified with
  `pnpm exec which moon`.