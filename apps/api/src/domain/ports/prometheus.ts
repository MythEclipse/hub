/**
 * Read-only access to a Prometheus HTTP API.
 *
 * Both methods return `null` / `[]` rather than throwing when Prometheus is
 * unreachable — a monitoring dashboard must degrade, not fail.
 */
export interface PrometheusClient {
  /** Instant vector lookup. Returns null when the query fails or matches nothing. */
  query(promql: string): Promise<number | null>;
  /** Range vector lookup, oldest sample first. Returns [] when it fails. */
  queryRange(
    promql: string,
    windowSeconds?: number,
    steps?: number,
  ): Promise<number[]>;
}
