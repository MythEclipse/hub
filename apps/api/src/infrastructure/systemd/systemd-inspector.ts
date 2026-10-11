import type { Service } from "../../domain/dashboard/dashboard.ts";
import type { SystemdInspector } from "../../domain/ports/systemd.ts";
import { discoverServices } from "./unit-discovery.ts";

/**
 * Parses the block-per-unit output of
 * `systemctl show a.service b.service -p Id -p ActiveState -p LoadState`.
 *
 * Pure and exported so it can be tested against fixture output. The bugs this
 * guards are invisible on a CI runner, where none of the monitored units are
 * installed, so a test that shells out to the real systemctl proves nothing
 * off-host.
 *
 * Retained for the state-parsing contract only: which units exist at all is now
 * discovered from the host (`./unit-discovery.ts`) rather than listed here.
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
    async listServices(): Promise<Service[]> {
      // Which units to report, and what hostnames they answer on, are read from
      // the host on every call. Nothing is listed in source, so a unit that is
      // uninstalled cannot linger: see unit-discovery.ts for the two cases that
      // a state filter alone cannot catch (a unit file outliving its program,
      // and a Caddy site outliving its upstream).
      const discovered = await discoverServices();

      return discovered.map((service) => ({
        name: service.name,
        state: service.state,
        hasWeb: service.hosts.length > 0,
        hosts: service.hosts,
      }));
    },
  };
}
