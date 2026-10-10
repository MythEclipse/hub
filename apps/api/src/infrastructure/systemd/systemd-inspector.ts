import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Service } from "../../domain/dashboard/dashboard.ts";
import type { SystemdInspector } from "../../domain/ports/systemd.ts";

const execFileAsync = promisify(execFile);

/**
 * Service-owning systemd units shown on the dashboard. GMW, Booster and friends
 * are listed even though they are headless (no public web endpoint).
 *
 * Kept in sync with the host by hand — every name here is a real unit on
 * host1760805970. Anything not installed is skipped at read time rather than
 * reported as degraded, so a stale entry here costs nothing but a stale
 * entry in the source list.
 */
export const MONITORED_UNITS = [
  "9router",
  "booster-role",
  "caddy",
  "flowsight",
  "gmw-backend",
  "gmw-frontend",
  "gmw-proxy",
  "hermyhq",
  "hermyhq-render",
  "hindsight",
  "hindsight-gate",
  "hindsight-ui",
  "hub",
  "mcpedia-api",
  "mcpedia-mcp",
  "mcpedia-web",
  "mcpedia-worker",
  "node-exporter",
  "otel",
  "pg-internal",
  "pr-agent-server",
  "prometheus",
  "qdrant-internal",
  "redis-internal",
  "scraper",
  "teleuploader",
  "zeavis-api",
  "zeavis-ml-service",
  "zeavis-web",
] as const;

/**
 * Units with a public HTTPS site, mapped to the hostnames Caddy actually
 * serves them on.
 *
 * This is an explicit map, not a derived name, because the hostname is not the
 * unit name: `scraper` is served at both scraper.asepharyana.my.id and
 * api.asepharyana.my.id, while `pr-agent-server` is published as pr-agent and
 * `mcpedia-web` as wiki. Composing `https://<unit>.<domain>` produced links to
 * names that resolve nowhere — for 9router, hermyhq and zeavis-web it guessed
 * right by coincidence and nothing else.
 *
 * Verified against the site blocks in /etc/caddy/Caddyfile.
 */
export const WEB_UNITS: ReadonlyMap<string, readonly string[]> = new Map([
  ["9router", ["9router.asepharyana.my.id"]],
  ["caddy", ["asepharyana.my.id"]],
  ["gmw-proxy", ["gmw.asepharyana.my.id"]],
  ["hermyhq", ["hamc.asepharyana.my.id"]],
  ["hub", ["hub.asepharyana.my.id", "asepharyana.my.id"]],
  ["mcpedia-web", ["mcpedia.asepharyana.my.id", "wiki.asepharyana.my.id"]],
  ["pr-agent-server", ["pr-agent.asepharyana.my.id"]],
  ["scraper", ["scraper.asepharyana.my.id", "api.asepharyana.my.id"]],
  ["teleuploader", ["upload.asepharyana.my.id"]],
  ["zeavis-web", ["zeavisedu.asepharyana.my.id"]],
]);

/**
 * Parses the block-per-unit output of
 * `systemctl show a.service b.service -p Id -p ActiveState -p LoadState`.
 *
 * Pure and exported so it can be tested against fixture output. The bugs this
 * guards are invisible on a CI runner, where none of the monitored units are
 * installed, so a test that shells out to the real systemctl proves nothing
 * off-host.
 */
export function parseSystemctlShow(
  stdout: string,
  webUnits: ReadonlyMap<string, readonly string[]>,
): Service[] {
  const services: Service[] = [];

  for (const block of stdout.split("\n\n")) {
    const id = block.match(/^Id=(\S+)/m)?.[1];
    const loadState = block.match(/^LoadState=(\S+)/m)?.[1];
    const state = block.match(/^ActiveState=(\w+)/m)?.[1];
    if (!id || !state) continue;

    // `systemctl show` exits 0 even for a unit that does not exist, so nothing
    // throws — it reports LoadState=not-found instead. Without this check every
    // unit missing on the host is counted as a degraded service, inflating the
    // "N degraded" badge and skewing the donut.
    if (loadState === "not-found") continue;

    const name = id.replace(/\.service$/, "");
    const hosts = webUnits.get(name) ?? [];
    services.push({
      name,
      state: state === "active" ? "running" : state,
      hasWeb: hosts.length > 0,
      hosts,
    });
  }

  return services;
}

export function createSystemdInspector(): SystemdInspector {
  return {
    async listServices(units, webUnits): Promise<Service[]> {
      // One call for every unit instead of one per unit: 22 execFile spawns
      // become 1, which is the bulk of the overview request's latency.
      const { stdout } = await execFileAsync(
        "systemctl",
        [
          "show",
          ...units.map((unit) => `${unit}.service`),
          "-p",
          "Id",
          "-p",
          "ActiveState",
          "-p",
          "LoadState",
          "--no-pager",
        ],
        // Without this a hung D-Bus socket stalls the request indefinitely,
        // and the 15s dashboard poll piles up behind it. Prometheus has
        // AbortSignal.timeout(5000); systemd had nothing.
        { timeout: 2000, maxBuffer: 1024 * 1024 },
      ).catch(() => ({ stdout: "" }));

      // systemd being unavailable entirely (no systemd, no D-Bus, container
      // without it) degrades to an empty list rather than throwing: one dead
      // dependency must not take down the CPU, memory and LLM numbers with
      // it. That matches how a failed Prometheus scrape degrades to null.
      return parseSystemctlShow(stdout, webUnits);
    },
  };
}
