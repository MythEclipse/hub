import type { Service } from "../dashboard/dashboard.ts";

/**
 * Reads service state from the init system.
 *
 * The domain depends on this interface only; the systemd implementation lives
 * in infrastructure and is injected into the use-case.
 */
export interface SystemdInspector {
  /**
   * Every service installed on this host, in systemd's own order.
   *
   * Takes no arguments: the set of units and the hostnames behind them are
   * host state, read at call time. Passing them in as arguments is what allowed
   * a checked-in list to outlive the services it named.
   *
   * Units that are not installed are skipped, not reported as errors.
   */
  listServices(): Promise<Service[]>;
}
