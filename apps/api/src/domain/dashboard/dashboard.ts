/**
 * Dashboard read model.
 *
 * Domain layer: no framework imports (no hono, no drizzle, no pino, no fetch).
 * Prometheus failures surface as `null`, never 0 — the UI renders "no data"
 * for null and would otherwise show a fake "0% CPU" during an outage.
 */

import type { PublicAccess } from "../llm/public-access.ts";

export interface Service {
  name: string;
  state: string;
  /**
   * "running" for a daemon, "oneshot" for a job that finishes and goes back to
   * inactive. A oneshot's resting state is `inactive` by design, so `state`
   * alone would report three healthy timer-driven jobs as degraded.
   */
  kind: "running" | "oneshot";
  /** Outcome of the most recent run: success, exit-code, signal, timeout… */
  result: string;
  /**
   * When a timer will run this again, as epoch milliseconds, or null when
   * nothing will. Epoch rather than a formatted string so the browser can
   * render it in the reader's own locale without re-parsing a host format.
   */
  schedule: { lastRun: number; nextRun: number | null } | null;
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

/**
 * The LLM router, as measured rather than as scraped.
 *
 * These fields used to come from `llm_api_*` Prometheus series, which stopped
 * existing when the router moved. Prometheus then answered nothing, so every
 * field rendered `—` and the ROUTER block read as a quiet router rather than a
 * broken query. The reading now comes from calling the router and timing it.
 *
 * Every field is null until the first probe lands. Null is the cold start and
 * the outage alike; `reachable` is what separates them once a probe has run.
 */
export interface LlmMetrics {
  /**
   * Whether the last probe got a completion back. Null before the first probe
   * — a router nobody has asked yet is not a reachable router.
   */
  reachable: boolean | null;
  /** Model id the router answered with, e.g. `free`. Null until probed. */
  model: string | null;
  /** End-to-end round-trip of the probe completion, in ms. */
  latencyMs: number | null;
  /**
   * Completion tokens per second over that round-trip. A floor, not a
   * benchmark: it includes time spent waiting for the first token.
   */
  tokSpeed: number | null;
  /** Epoch ms of the sample, so the sheet can show how old the reading is. */
  checkedAt: number | null;
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
  /**
   * Router credentials published on the portfolio, or null when the router key
   * is unconfigured. It rides on this payload rather than its own procedure so
   * the hero, the ledger and the credentials block cost one request between
   * them.
   */
  access: PublicAccess | null;
}
