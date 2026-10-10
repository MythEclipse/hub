import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Service } from "../../domain/dashboard/dashboard.ts";
import type { SystemdInspector } from "../../domain/ports/systemd.ts";

const execFileAsync = promisify(execFile);

/**
 * Service-owning systemd units shown on the dashboard. GMW, Booster and friends
 * are listed even though they are headless (no public web endpoint).
 */
export const MONITORED_UNITS = [
  "caddy",
  "9router",
  "booster-role",
  "gmw-backend",
  "gmw-discord-gateway",
  "hub",
  "lidm-backend",
  "lidm-frontend",
  "llm-api",
  "nats",
  "node-exporter",
  "otel",
  "pr-agent-server",
  "prometheus",
  "scraper",
  "teleuploader",
  "tools-frontend",
  "tools-gateway",
  "tools-workers",
  "zeavis-api",
  "zeavis-ml-service",
  "zeavis-web",
] as const;

/** Units with a public HTTPS site behind Caddy. */
export const WEB_UNITS: ReadonlySet<string> = new Set([
  "caddy",
  "9router",
  "hub",
  "lidm-frontend",
  "pr-agent-server",
  "scraper",
  "teleuploader",
  "tools-frontend",
  "zeavis-web",
]);

export function createSystemdInspector(): SystemdInspector {
  return {
    async listServices(units, webUnits): Promise<Service[]> {
      const services: Service[] = [];

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
      );

      // One call for every unit instead of one per unit: 22 execFile spawns
      // become 1, which is the bulk of the overview request's latency.
      for (const block of stdout.split("\n\n")) {
        const id = block.match(/^Id=(\S+)/m)?.[1];
        const loadState = block.match(/^LoadState=(\S+)/m)?.[1];
        const state = block.match(/^ActiveState=(\w+)/m)?.[1];
        if (!id || !state) continue;

        // `systemctl show` exits 0 even for a unit that does not exist, so this
        // never throws — it reports LoadState=not-found instead. Without the
        // check, every unit missing on this host is counted as a degraded
        // service, inflating the "N degraded" badge and skewing the donut.
        if (loadState === "not-found") continue;

        services.push({
          name: id.replace(/\.service$/, ""),
          state: state === "active" ? "running" : state,
          hasWeb: webUnits.has(id.replace(/\.service$/, "")),
        });
      }

      return services;
    },
  };
}
