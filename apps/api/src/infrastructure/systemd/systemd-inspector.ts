import type { Service } from "../../domain/dashboard/dashboard.ts";
import type { SystemdInspector } from "../../domain/ports/systemd.ts";
import { discoverServices } from "./unit-discovery.ts";

/**
 * The port onto host state.
 *
 * Every reading — which units exist, what state they are in, whether their
 * program is still on disk, which hostnames are live — happens in
 * `unit-discovery.ts`, against the host, at call time.
 */
export function createSystemdInspector(): SystemdInspector {
  return {
    async listServices(): Promise<Service[]> {
      const discovered = await discoverServices();

      return discovered.map((service) => ({
        name: service.name,
        state: service.state,
        kind: service.kind,
        result: service.result,
        schedule: service.schedule,
        hasWeb: service.hosts.length > 0,
        hosts: service.hosts,
      }));
    },
  };
}
