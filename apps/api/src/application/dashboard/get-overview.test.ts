import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { makeGetOverview } from "./get-overview.ts";

/**
 * The invariant this file exists to protect: a failing Prometheus scraper must
 * surface as null / [], NEVER as 0. If nulls degrade to zeros, a total scrape
 * outage renders as "0% CPU, all clear" instead of "no data".
 */

const deps = {
  prometheus: {
    query: async () => null,
    queryRange: async () => [],
  },
  staticLinks: [],
};

describe("getOverview", () => {
  it("preserves null when every scrape fails", async () => {
    const overview = await makeGetOverview({
      ...deps,
      systemd: {
        listServices: async () => [
          { name: "caddy", state: "running", hasWeb: false, hosts: [] },
        ],
      },
    })();

    assert.equal(overview.node.cpu, null);
    assert.equal(overview.node.ram, null);
    assert.equal(overview.node.disk, null);
    assert.equal(overview.node.netIn, null);
    assert.equal(overview.node.cpuCores, null);
    assert.deepEqual(overview.node.ramBytes, { used: null, total: null });
    assert.deepEqual(overview.node.diskBytes, { used: null, total: null });
    assert.deepEqual(overview.rps, []);
    assert.deepEqual(overview.errors, []);
    assert.equal(overview.llm.reqRate, null);
  });

  it("passes measured values straight through", async () => {
    const overview = await makeGetOverview({
      ...deps,
      systemd: { listServices: async () => [] },
      prometheus: {
        query: async (q: string) => (q === "node_load1" ? 0.42 : 7),
        queryRange: async () => [1, 2, 3],
      },
    })();

    assert.equal(overview.node.load1, 0.42);
    assert.equal(overview.node.cpu, 7);
    assert.deepEqual(overview.rps, [1, 2, 3]);
  });

  it("links only services that are both web-facing and running", async () => {
    const overview = await makeGetOverview({
      ...deps,
      systemd: {
        listServices: async () => [
          {
            name: "hub",
            state: "running",
            hasWeb: true,
            hosts: ["hub.example.test"],
          },
          {
            name: "hub-broken",
            state: "failed",
            hasWeb: true,
            hosts: ["broken.example.test"],
          },
          {
            name: "headless",
            state: "running",
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
            { name: "caddy", state: "running", hasWeb: false, hosts: [] },
          ];
        },
      },
    });

    await Promise.all([getOverview(), getOverview(), getOverview()]);

    assert.equal(systemdCalls, 1, "concurrent polls must share one scrape");
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
