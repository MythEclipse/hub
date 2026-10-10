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
  units: ["caddy", "hub"],
  webUnits: new Map([["hub", ["hub.example.test"]]]),
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
});
