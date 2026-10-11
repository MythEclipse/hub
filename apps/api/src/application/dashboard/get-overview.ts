import type {
  Capacity,
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
  const { systemd, prometheus, staticLinks } = deps;

  const services: Service[] = await systemd.listServices();

  const [
    cpu,
    ram,
    disk,
    load1,
    load5,
    load15,
    netIn,
    netOut,
    diskTotal,
    diskAvail,
    ramTotal,
    ramAvail,
    cpuCores,
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
    // Denominators for the three gauges. The disk ratio above already reads
    // these two series; asking again costs one cached query each and turns a
    // bare percentage into a real "94 GB of 115 GB".
    prometheus.query(
      `node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"}`,
    ),
    prometheus.query(
      `node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs"}`,
    ),
    prometheus.query("node_memory_MemTotal_bytes"),
    prometheus.query("node_memory_MemAvailable_bytes"),
    // Counted, not averaged: a CPU percentage means little without knowing
    // whether it is 2 cores saturated or 8 cores mostly idle.
    prometheus.query(`count(count by(cpu) (node_cpu_seconds_total))`),
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
    cpuCores,
    ramBytes: capacity(ramAvail, ramTotal),
    diskBytes: capacity(diskAvail, diskTotal),
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
    links: buildLinks(staticLinks, services),
    llm,
  };
}

/**
 * Builds a used/total pair from an "available" and a "total" reading.
 *
 * `avail` is the free space Prometheus reports, which is not the same as unused
 * space: the filesystem reserves blocks for root. The dashboard's percentage
 * has always been computed from `avail`, so `used` is derived the same way to
 * keep the figure and its denominator telling the same story.
 *
 * Either side null yields a null pair, never a zero: a "0 GB of 0 GB" reading
 * would look like an empty disk rather than an unanswered query.
 */
function capacity(avail: number | null, total: number | null): Capacity {
  if (total === null || total <= 0 || avail === null) {
    return { used: null, total: null };
  }
  return { used: total - avail, total };
}

function buildLinks(
  staticLinks: readonly DashboardLink[],
  services: readonly Service[],
): DashboardLink[] {
  const links: DashboardLink[] = [...staticLinks];
  for (const service of services) {
    if (!service.hasWeb || service.state !== "running") continue;
    for (const host of service.hosts) {
      links.push({ url: `https://${host}`, label: service.name });
    }
  }
  return links;
}
