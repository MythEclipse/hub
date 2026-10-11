/**
 * Dashboard read model.
 *
 * Domain layer: no framework imports (no hono, no drizzle, no pino, no fetch).
 * Prometheus failures surface as `null`, never 0 — the UI renders "no data"
 * for null and would otherwise show a fake "0% CPU" during an outage.
 */

export interface Service {
  name: string;
  state: string;
  hasWeb: boolean;
  /**
   * Hostnames this service is published on, empty when it has no public site.
   * Explicit rather than composed from the unit name: the Caddy hostname is
   * often not the unit name.
   */
  hosts: readonly string[];
}

export interface Trace {
  service: string;
  operation: string;
  duration: number;
  spans: number;
  hasError: boolean;
}

/**
 * A usage figure with the capacity it is measured against.
 *
 * `used` and `total` are both nullable together: a percentage without its
 * denominator is not a reading, it is a vibe. When Prometheus cannot answer the
 * capacity query the whole pair is null, so the UI can say "no data" instead of
 * printing a bare "81.9%" that sounds precise and measures nothing.
 */
export interface Capacity {
  used: number | null;
  total: number | null;
}

export interface NodeResources {
  cpu: number | null;
  ram: number | null;
  disk: number | null;
  /**
   * Denominators for the three gauges. Each is null independently of its
   * percentage: Prometheus can answer the ratio while the capacity query is
   * briefly unavailable, and the UI shows the figure without the total rather
   * than dropping a true reading over a missing annotation.
   */
  cpuCores: number | null;
  ramBytes: Capacity;
  diskBytes: Capacity;
  load1: number | null;
  load5: number | null;
  load15: number | null;
  netIn: number | null;
  netOut: number | null;
}

export interface LlmMetrics {
  reqRate: number | null;
  tokRate: number | null;
  tokSpeed: number | null;
  uptime: number | null;
  reqSpark: number[];
  tokSpark: number[];
}

export interface DashboardLink {
  url: string;
  label: string;
}

export interface DashboardOverview {
  services: Service[];
  traces: Trace[];
  node: NodeResources;
  rps: number[];
  latency: number[];
  errors: number[];
  traceVolume: number[];
  links: DashboardLink[];
  llm: LlmMetrics;
}
