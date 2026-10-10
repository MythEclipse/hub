import type {
  DashboardLink,
  DashboardOverview,
  LlmMetrics,
  NodeResources,
  Service,
} from "../../domain/dashboard/dashboard.ts";
import type { PrometheusClient } from "../../domain/ports/prometheus.ts";
import type { SystemdInspector } from "../../domain/ports/systemd.ts";

export interface GetOverviewDeps {
  systemd: SystemdInspector;
  prometheus: PrometheusClient;
  /** Units to report, in display order. */
  units: readonly string[];
  /** Subset of `units` that has a public HTTPS endpoint behind Caddy. */
  webUnits: ReadonlySet<string>;
  /** Base domain used to build service links. */
  baseDomain: string;
  /** Static links always shown (e.g. the GitHub repo). */
  staticLinks: readonly DashboardLink[];
}

const RANGE_WINDOW_SECONDS = 300;
const RANGE_STEPS = 20;
// Every browser tab polls every 15s, and one overview costs 22 systemctl
// lookups + 18 PromQL queries. A short memo collapses concurrent tabs into a
// single upstream round-trip; it is far shorter than the poll interval, so no
// tab can outrun it.
const OVERVIEW_TTL_MS = 5000;

/**
 * Assembles the whole dashboard payload.
 *
 * Every Prometheus call runs concurrently; a failing scraper yields null/[]
 * and the UI falls back to its "no data" rendering rather than erroring.
 */
export function makeGetOverview(deps: GetOverviewDeps) {
  let cached: { at: number; payload: DashboardOverview } | undefined;
  let inFlight: Promise<DashboardOverview> | undefined;

  return async (): Promise<DashboardOverview> => {
    // Collapse duplicate concurrent requests onto one upstream call, but let
    // a call that is already running finish rather than restarting it.
    if (inFlight) return inFlight;

    if (cached && Date.now() - cached.at < OVERVIEW_TTL_MS)
      return cached.payload;

    inFlight = build(deps).finally(() => {
      inFlight = undefined;
    });

    // Only a successful overview is cached: caching a rejection would show a
    // stale "healthy" picture for the whole TTL after Prometheus recovers.
    const payload = await inFlight;
    cached = { at: Date.now(), payload };
    return payload;
  };
}

async function build(deps: GetOverviewDeps): Promise<DashboardOverview> {
  const { systemd, prometheus, units, webUnits, baseDomain, staticLinks } =
    deps;

  const services: Service[] = await systemd.listServices(units, webUnits);

  const [
    cpu,
    ram,
    disk,
    load1,
    load5,
    load15,
    netIn,
    netOut,
    netInSpark,
    loadSpark,
    reqSpark,
    errSpark,
    llmReqRate,
    llmTokRate,
    llmTokSpeed,
    llmUptime,
    llmReqSpark,
    llmTokSpark,
  ] = await Promise.all([
    prometheus.query(
      `100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)`,
    ),
    prometheus.query(
      `(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100`,
    ),
    prometheus.query(
      `(1 - node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs"} / node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"}) * 100`,
    ),
    prometheus.query("node_load1"),
    prometheus.query("node_load5"),
    prometheus.query("node_load15"),
    // sum() over devices: these two feed the "Network In/Out" readouts, and
    // the host has eth0 + tailscale0. Without the aggregation the client reads
    // result[0] only, so tailscale traffic was silently dropped.
    prometheus.query(
      `sum(rate(node_network_receive_bytes_total{device!="lo"}[1m]))`,
    ),
    prometheus.query(
      `sum(rate(node_network_transmit_bytes_total{device!="lo"}[1m]))`,
    ),
    prometheus.queryRange(
      `sum(rate(node_network_receive_bytes_total{device!="lo"}[1m]))`,
      RANGE_WINDOW_SECONDS,
      RANGE_STEPS,
    ),
    prometheus.queryRange("avg(node_load1)", RANGE_WINDOW_SECONDS, RANGE_STEPS),
    prometheus.queryRange(
      `sum(rate(llm_api_requests_total[1m])) + sum(rate(http_server_request_count_total[1m]))`,
      RANGE_WINDOW_SECONDS,
      RANGE_STEPS,
    ),
    prometheus.queryRange(
      `sum(rate(llm_api_errors_total[1m]))`,
      RANGE_WINDOW_SECONDS,
      RANGE_STEPS,
    ),
    prometheus.query(
      `sum(rate(llm_api_requests_total{service="llm-api"}[5m]))`,
    ),
    prometheus.query(
      `sum(rate(llm_api_completion_tokens_total{service="llm-api"}[5m]))`,
    ),
    prometheus.query(`avg(llm_api_tokens_per_second{service="llm-api"})`),
    prometheus.query(`llm_api_uptime_seconds{service="llm-api"}`),
    prometheus.queryRange(
      `sum(rate(llm_api_requests_total{service="llm-api"}[1m]))`,
      RANGE_WINDOW_SECONDS,
      RANGE_STEPS,
    ),
    prometheus.queryRange(
      `sum(rate(llm_api_completion_tokens_total{service="llm-api"}[1m]))`,
      RANGE_WINDOW_SECONDS,
      RANGE_STEPS,
    ),
  ]);

  const node: NodeResources = {
    cpu,
    ram,
    disk,
    load1,
    load5,
    load15,
    netIn,
    netOut,
  };
  const llm: LlmMetrics = {
    reqRate: llmReqRate,
    tokRate: llmTokRate,
    tokSpeed: llmTokSpeed,
    uptime: llmUptime,
    reqSpark: llmReqSpark,
    tokSpark: llmTokSpark,
  };

  return {
    services,
    // No Jaeger/OTel client exists yet, so there is nothing to report here.
    traces: [],
    node,
    rps: reqSpark,
    latency: loadSpark,
    errors: errSpark,
    traceVolume: netInSpark,
    links: buildLinks(staticLinks, services, baseDomain),
    llm,
  };
}

function buildLinks(
  staticLinks: readonly DashboardLink[],
  services: readonly Service[],
  baseDomain: string,
): DashboardLink[] {
  const links: DashboardLink[] = [...staticLinks];
  for (const service of services) {
    if (service.hasWeb && service.state === "running") {
      links.push({
        url: `https://${service.name}.${baseDomain}`,
        label: service.name,
      });
    }
  }
  return links;
}
