import type {
  Capacity,
  DashboardLink,
  DashboardOverview,
  LlmMetrics,
  NodeResources,
  Service,
} from "../../domain/dashboard/dashboard.ts";
import type { PublicAccess } from "../../domain/llm/public-access.ts";
import type { PrometheusClient } from "../../domain/ports/prometheus.ts";
import type { SystemdInspector } from "../../domain/ports/systemd.ts";
import type { LlmTelemetry } from "../llm/llm-telemetry.ts";

export interface GetOverviewDeps {
  systemd: SystemdInspector;
  prometheus: PrometheusClient;
  /**
   * The LLM router reading. Supplied as a service rather than a set of
   * PromQL queries: the router moved and its `llm_api_*` series went with it,
   * so the metrics are measured by calling the router, not scraped.
   */
  llm: LlmTelemetry;
  /** Static links always shown (e.g. the GitHub repo). */
  staticLinks: readonly DashboardLink[];
  /** Credentials published on the portfolio. */
  publicAccess: PublicAccess;
}

// Every browser tab polls every 15s, and one overview costs 45 systemctl
// lookups + 4 PromQL queries. A short memo collapses concurrent tabs into a
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
  const { systemd, prometheus, llm, staticLinks, publicAccess } = deps;

  const services: Service[] = await systemd.listServices();

  // Only what the sheet renders is queried. Two groups used to sit here and are
  // gone: `http_server_request_count_total` and `llm_api_*` stopped existing, so
  // they cost a round-trip to answer nothing; and load averages plus network
  // throughput are not read by any component. `[]` from a dead query is
  // indistinguishable from "no traffic", which is the fake-zero failure this
  // file exists to avoid.
  const [cpu, ram, disk, cpuCores, diskTotal, diskAvail, ramTotal, ramAvail] =
    await Promise.all([
      prometheus.query(
        `100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)`,
      ),
      prometheus.query(
        `(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100`,
      ),
      prometheus.query(
        `(1 - node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs"} / node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"}) * 100`,
      ),
      // Counted, not averaged: a CPU percentage means little without knowing
      // whether it is 2 cores saturated or 8 cores mostly idle.
      prometheus.query(`count(count by(cpu) (node_cpu_seconds_total))`),
      // Denominators for the RAM and DISK captions. The disk ratio above already
      // reads these two series; asking again costs one cached query each and
      // turns a bare percentage into a real "94 GB of 115 GB".
      prometheus.query(
        `node_filesystem_size_bytes{mountpoint="/",fstype!="tmpfs"}`,
      ),
      prometheus.query(
        `node_filesystem_avail_bytes{mountpoint="/",fstype!="tmpfs"}`,
      ),
      prometheus.query("node_memory_MemTotal_bytes"),
      prometheus.query("node_memory_MemAvailable_bytes"),
    ]);

  const node: NodeResources = {
    cpu,
    ram,
    disk,
    cpuCores,
    ramBytes: capacity(ramAvail, ramTotal),
    diskBytes: capacity(diskAvail, diskTotal),
  };

  // `read()` never awaits the network: it hands back the last sample and
  // schedules a fresh probe when that sample is stale.
  const llmMetrics: LlmMetrics = llm.read();

  return {
    services,
    node,
    links: buildLinks(staticLinks, services),
    llm: llmMetrics,
    access: publicAccess,
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
