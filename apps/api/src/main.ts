import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { buildUseCases } from "./application/use-cases.ts";
import { env } from "./infrastructure/config/env.ts";
import { logger } from "./infrastructure/observability/logger.ts";
import { createPrometheusClient } from "./infrastructure/prometheus/prometheus-client.ts";
import {
  createSystemdInspector,
  MONITORED_UNITS,
  WEB_UNITS,
} from "./infrastructure/systemd/systemd-inspector.ts";
import { buildContext } from "./presentation/orpc/context.ts";
import { buildRouter } from "./presentation/routers/index.ts";

const useCases = buildUseCases(
  {
    systemd: createSystemdInspector(),
    prometheus: createPrometheusClient(env.PROMETHEUS_URL),
  },
  {
    units: MONITORED_UNITS,
    webUnits: WEB_UNITS,
    staticLinks: [{ url: env.GITHUB_REPO_URL, label: "GitHub" }],
  },
);

const app = new Hono();

app.use("*", requestId());

// Registered before the SPA catch-all so it is never shadowed by it.
// Reports whether the SPA is actually servable, so a release whose web build
// is missing fails the deploy health check instead of shipping a blank page.
app.get("/healthz", (c) => {
  const healthy = !env.WEB_DIST_PATH || spaReady;
  return c.json(
    {
      status: healthy ? "ok" : "degraded",
      spa: spaReady ? "ready" : env.WEB_DIST_PATH ? "missing" : "disabled",
    },
    healthy ? 200 : 503,
  );
});

const rpcHandler = new RPCHandler(buildRouter(useCases));

// The handler matches procedures against the full request path, so the mount
// prefix has to be stripped before delegating (verified: "/rpc/demo/ping"
// does not match, "/demo/ping" does).
app.use("/rpc/*", async (c) => {
  const url = new URL(c.req.url);
  const stripped = new Request(
    new URL(url.pathname.replace(/^\/rpc/, "") || "/", url.origin),
    c.req.raw,
  );

  const response = await rpcHandler.handle(stripped, {
    context: buildContext(c.req.raw.headers, useCases),
  });

  if (response.matched) return response.response;

  // Unmatched path: answer JSON 404 here. Calling next() would fall through to
  // the SPA catch-all and answer 200 text/html, so any monitor or curl probing
  // /rpc would be told the API is fine when it is not.
  return c.json({ error: "unknown procedure", path: url.pathname }, 404);
});

// ── SPA (production) ────────────────────────────────────────────────────────
// Hono serves the built frontend so the whole app runs as one process on one
// port. In development Vite serves the SPA and proxies /rpc here instead.
//
// If WEB_DIST_PATH is set but unusable we must NOT quietly fall through to a
// 200 on `/`: the deploy health-checks that URL, and a blank site that still
// answers 200 would be published as a successful release.
const distPath = env.WEB_DIST_PATH ? resolve(env.WEB_DIST_PATH) : undefined;
const indexHtml = distPath ? join(distPath, "index.html") : undefined;
const spaReady = Boolean(indexHtml && existsSync(indexHtml));

if (env.WEB_DIST_PATH && !spaReady) {
  logger.error(
    { webDistPath: env.WEB_DIST_PATH },
    "WEB_DIST_PATH is set but index.html is missing — / will answer 503",
  );
}

if (distPath && spaReady && indexHtml) {
  // Serve real files (hashed assets, favicon, …) when they exist on disk.
  app.get("*", async (c, next) => {
    // Resolve against the raw pathname so %2e%2e cannot smuggle a traversal;
    // re-check the result is still inside dist before reading anything.
    // A malformed escape makes decodeURIComponent throw URIError, which would
    // otherwise become an unauthenticated 500 — treat it as a bad request.
    let relative: string;
    try {
      relative = decodeURIComponent(new URL(c.req.url).pathname).replace(
        /^\/+/,
        "",
      );
    } catch {
      return c.notFound();
    }
    const filePath = resolve(distPath, relative);

    if (filePath !== distPath && !filePath.startsWith(`${distPath}/`)) {
      return c.notFound();
    }

    if (
      filePath !== distPath &&
      existsSync(filePath) &&
      statSync(filePath).isFile()
    ) {
      return new Response(await readFile(filePath), {
        headers: { "content-type": contentTypeFor(filePath) },
      });
    }

    return next();
  });

  // Client-side routing: everything else falls through to index.html so
  // /dashboard and friends resolve in the browser instead of 404ing.
  app.get("*", async (c) => {
    // Hashed build output. A missing chunk means the browser is running a stale
    // index.html, so answering it with 200 text/html produces a MIME error at
    // best and silent corruption at worst. 404 lets the error surface here.
    if (c.req.path.startsWith("/assets/")) return c.notFound();

    try {
      const body = await readFile(indexHtml);
      return new Response(body, { headers: { "content-type": "text/html" } });
    } catch {
      return c.text("web build not found", 503);
    }
  });
} else {
  // No SPA configured, or it is broken. Never answer 200 to a browser request.
  app.get("*", (c) =>
    c.json(
      {
        error: "web build unavailable",
        webDistPath: env.WEB_DIST_PATH ?? null,
      },
      503,
    ),
  );
}

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs"))
    return "text/javascript";
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".woff2")) return "font/woff2";
  if (filePath.endsWith(".woff")) return "font/woff";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

app.onError((error, c) => {
  logger.error(
    { err: error, requestId: c.get("requestId") },
    "unhandled error",
  );
  return c.json({ error: "Internal Server Error" }, 500);
});

serve({ fetch: app.fetch, port: env.PORT });

logger.info(
  { port: env.PORT, webDistPath: env.WEB_DIST_PATH ?? null },
  "hub api listening",
);

export type { AppRouter } from "./index.ts";
export { app };
