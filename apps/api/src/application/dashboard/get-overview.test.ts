import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { makeGetOverview } from "./get-overview.ts";

/**
 * The invariant this file exists to protect: a failing Prometheus scraper must
 * surface as null / [], NEVER as 0. If nulls degrade to zeros, a total scrape
 * outage renders as "0% CPU, all clear" instead of "no data".
 */

/**
 * A telemetry stub that reports "no sample yet", the cold-start state. The
 * dashboard reading is a probe result now, not a PromQL query, so it is
 * injected rather than scraped — which is also what makes it testable without
 * a network.
 */
const noLlmSample = {
  read: () => ({
    reachable: null,
    model: null,
    latencyMs: null,
    tokSpeed: null,
    checkedAt: null,
  }),
  refresh: () => {},
};

const deps = {
  prometheus: {
    query: async () => null,
    queryRange: async () => [],
  },
  llm: noLlmSample,
  staticLinks: [],
  publicAccess: {
    baseUrl: "https://router.test/v1",
    model: "free",
    apiKey: "sk-test",
    curl: "curl …",
  },
};

describe("getOverview", () => {
  it("preserves null when every scrape fails", async () => {
    const overview = await makeGetOverview({
      ...deps,
      systemd: {
        listServices: async () => [
          {
            name: "caddy",
            state: "running",
            kind: "running",
            result: "success",
            schedule: null,
            hasWeb: false,
            hosts: [],
          },
        ],
      },
    })();

    assert.equal(overview.node.cpu, null);
    assert.equal(overview.node.ram, null);
    assert.equal(overview.node.disk, null);
    assert.equal(overview.node.cpuCores, null);
    // No sample yet is not "reachable": a router nobody has probed must not
    // read as a healthy one on the cold-start poll.
    assert.equal(overview.llm.reachable, null);
    assert.equal(overview.llm.latencyMs, null);
    assert.equal(overview.llm.model, null);
  });

  /**
   * The payload carries no field the UI does not draw. Four sparkline arrays
   * and the used/total capacity pairs used to ride along, fetched on every
   * poll; two of the sparklines were fed by PromQL series that no longer exist
   * and returned `[]` forever, which is indistinguishable from "no traffic".
   */
  it("publishes no field the sheet cannot render", async () => {
    const overview = await makeGetOverview({
      ...deps,
      systemd: { listServices: async () => [] },
    })();

    for (const dead of ["rps", "latency", "errors", "traceVolume", "traces"]) {
      assert.equal(
        dead in overview,
        false,
        `"${dead}" is still in the payload but no component reads it`,
      );
    }
    assert.deepEqual(
      Object.keys(overview.node).sort(),
      ["cpu", "cpuCores", "disk", "diskBytes", "ram", "ramBytes"],
      "NodeResources grew a field nothing renders",
    );
  });

  it("passes a measured router sample straight through", async () => {
    const checkedAt = 1_760_000_000_000;
    const overview = await makeGetOverview({
      ...deps,
      systemd: { listServices: async () => [] },
      llm: {
        read: () => ({
          reachable: true,
          model: "free",
          latencyMs: 2_509,
          tokSpeed: 3.19,
          checkedAt,
        }),
        refresh: () => {},
      },
      publicAccess: {
        baseUrl: "https://router.test/v1",
        model: "free",
        apiKey: "sk-test",
        curl: "curl …",
      },
    })();

    assert.equal(overview.llm.reachable, true);
    assert.equal(overview.llm.model, "free");
    assert.equal(overview.llm.latencyMs, 2_509);
    assert.equal(overview.llm.tokSpeed, 3.19);
    assert.equal(overview.llm.checkedAt, checkedAt);
    assert.equal(overview.access?.apiKey, "sk-test");
  });

  it("passes measured values straight through", async () => {
    const overview = await makeGetOverview({
      ...deps,
      systemd: { listServices: async () => [] },
      prometheus: {
        query: async (q: string) =>
          q.startsWith("count(count by(cpu)") ? 8 : 7,
        queryRange: async () => [],
      },
    })();

    assert.equal(overview.node.cpu, 7);
    assert.equal(overview.node.cpuCores, 8);
  });

  it("links only services that are both web-facing and running", async () => {
    const overview = await makeGetOverview({
      ...deps,
      systemd: {
        listServices: async () => [
          {
            name: "hub",
            state: "running",
            kind: "running",
            result: "success",
            schedule: null,
            hasWeb: true,
            hosts: ["hub.example.test"],
          },
          {
            name: "hub-broken",
            state: "failed",
            kind: "running",
            result: "exit-code",
            schedule: null,
            hasWeb: true,
            hosts: ["broken.example.test"],
          },
          {
            name: "headless",
            state: "running",
            kind: "running",
            result: "success",
            schedule: null,
            hasWeb: false,
            hosts: [],
          },
        ],
      },
    })();

    assert.deepEqual(overview.links, [
      { url: "https://hub.example.test", label: "hub" },
    ]);
  });

  it("emits one link per published hostname, not one per unit", async () => {
    // scraper answers on two domains; guessing the hostname from the unit name
    // produced a single dead link instead of both real ones.
    const overview = await makeGetOverview({
      ...deps,
      systemd: {
        listServices: async () => [
          {
            name: "scraper",
            state: "running",
            kind: "running",
            result: "success",
            schedule: null,
            hasWeb: true,
            hosts: ["scraper.example.test", "api.example.test"],
          },
        ],
      },
    })();

    assert.deepEqual(overview.links, [
      { url: "https://scraper.example.test", label: "scraper" },
      { url: "https://api.example.test", label: "scraper" },
    ]);
  });

  it("memoises concurrent calls onto one upstream round-trip", async () => {
    let systemdCalls = 0;
    const getOverview = makeGetOverview({
      ...deps,
      systemd: {
        listServices: async () => {
          systemdCalls++;
          return [
            {
              name: "caddy",
              state: "running",
              kind: "running",
              result: "success",
              schedule: null,
              hasWeb: false,
              hosts: [],
            },
          ];
        },
      },
    });

    await Promise.all([getOverview(), getOverview(), getOverview()]);

    assert.equal(systemdCalls, 1, "concurrent polls must share one scrape");
  });

  it("queries only the series it renders", async () => {
    // Every dead query is a round-trip spent to answer nothing, and a `[]` from
    // a series that no longer exists is indistinguishable from "no traffic".
    const asked: string[] = [];
    await makeGetOverview({
      ...deps,
      systemd: { listServices: async () => [] },
      prometheus: {
        query: async (q: string) => {
          asked.push(q);
          return 1;
        },
        queryRange: async () => [],
      },
    })();

    assert.equal(asked.length, 8, "the overview should cost eight queries");
    for (const dead of [
      "http_server_request_count_total",
      "llm_api_requests_total",
      "llm_api_errors_total",
      "llm_api_completion_tokens_total",
      "llm_api_tokens_per_second",
      "llm_api_uptime_seconds",
      "node_load",
      "node_network_",
    ]) {
      assert.ok(
        !asked.some((q) => q.includes(dead)),
        `still querying "${dead}", which nothing renders`,
      );
    }
  });

  it("keeps the CPU core count independent of the CPU percentage", async () => {
    // A true reading must not disappear because its caption is missing.
    const overview = await makeGetOverview({
      ...deps,
      systemd: { listServices: async () => [] },
      prometheus: {
        query: async (q: string) =>
          q.startsWith("count(count by(cpu)") ? null : 55,
        queryRange: async () => [],
      },
    })();

    assert.equal(overview.node.cpu, 55);
    assert.equal(overview.node.cpuCores, null);
  });

  it("reports a denominator alongside each percentage", async () => {
    // A bare "81.9%" measures nothing: the reader cannot tell whether that is
    // a nearly full small disk or a nearly empty large one.
    const overview = await makeGetOverview({
      ...deps,
      systemd: { listServices: async () => [] },
      prometheus: {
        query: async (q: string) => {
          if (q.includes("node_filesystem_size_bytes")) return 123_690_532_864;
          if (q.includes("node_filesystem_avail_bytes")) return 22_370_123_776;
          if (q === "node_memory_MemTotal_bytes") return 16_763_211_776;
          if (q === "node_memory_MemAvailable_bytes") return 9_221_988_352;
          if (q.startsWith("count(count by(cpu)")) return 8;
          return null;
        },
        queryRange: async () => [],
      },
    })();

    assert.equal(overview.node.cpuCores, 8);
    assert.equal(overview.node.diskBytes.total, 123_690_532_864);
    assert.equal(
      overview.node.diskBytes.used,
      123_690_532_864 - 22_370_123_776,
    );
    assert.equal(overview.node.ramBytes.total, 16_763_211_776);
    assert.equal(overview.node.ramBytes.used, 16_763_211_776 - 9_221_988_352);
  });

  it("keeps a null total when only the capacity query fails", async () => {
    // The percentage is a true reading even when the denominator is missing, so
    // the total degrades on its own rather than taking the figure down with it.
    const overview = await makeGetOverview({
      ...deps,
      systemd: { listServices: async () => [] },
      prometheus: {
        query: async (q: string) =>
          q === "node_memory_MemTotal_bytes" ? null : 55,
        queryRange: async () => [],
      },
    })();

    assert.equal(overview.node.ram, 55);
    assert.deepEqual(overview.node.ramBytes, { used: null, total: null });
  });

  it("refuses to report a zero total", async () => {
    // 0 of 0 reads as an empty disk rather than an unanswered query.
    const overview = await makeGetOverview({
      ...deps,
      systemd: { listServices: async () => [] },
      prometheus: {
        query: async (q: string) => (q.includes("size_bytes") ? 0 : 10),
        queryRange: async () => [],
      },
    })();

    assert.deepEqual(overview.node.diskBytes, { used: null, total: null });
  });
});
