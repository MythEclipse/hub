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

export interface NodeResources {
  cpu: number | null;
  ram: number | null;
  disk: number | null;
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
