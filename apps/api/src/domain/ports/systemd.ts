import type { Service } from "../dashboard/dashboard.ts";

/**
 * Reads service state from the init system.
 *
 * The domain depends on this interface only; the systemd implementation lives
 * in infrastructure and is injected into the use-case.
 */
export interface SystemdInspector {
  /** Units that do not exist on this host are skipped, not reported as errors. */
  listServices(
    units: readonly string[],
    webUnits: ReadonlySet<string>,
  ): Promise<Service[]>;
}
