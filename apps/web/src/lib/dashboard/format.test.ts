import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fmtUptime, gaugeColor, safeDur, serviceIndicator } from "./format.ts";

// Sibling-relative import on purpose: the `#/` alias lives only in
// apps/web/tsconfig.json and is resolved only by the Vite plugin, so Node's
// runner cannot follow it.

describe("safeDur", () => {
  it("formats each magnitude at its boundary", () => {
    assert.equal(safeDur(999), "999µs");
    assert.equal(safeDur(1000), "1.0ms");
    assert.equal(safeDur(1_000_000), "1.00s");
    assert.equal(safeDur(0), "0µs");
  });
});

describe("gaugeColor", () => {
  it("reports no data as neutral, never as healthy", () => {
    // Green is the healthy signal; null used to return it, which made a
    // scrape outage indistinguishable from a quiet host.
    assert.notEqual(gaugeColor(null), gaugeColor(0));
  });

  it("switches to amber over 60 and red over 80", () => {
    assert.equal(gaugeColor(60), gaugeColor(0));
    assert.notEqual(gaugeColor(60.1), gaugeColor(60));
    assert.notEqual(gaugeColor(80.1), gaugeColor(60.1));
  });
});

describe("serviceIndicator", () => {
  it("marks only running services green", () => {
    assert.equal(serviceIndicator("running"), "bg-green-400");
    assert.notEqual(serviceIndicator("failed"), "bg-green-400");
  });
});

describe("fmtUptime", () => {
  it("rolls up through every unit", () => {
    assert.equal(fmtUptime(30), "30s");
    assert.equal(fmtUptime(90), "1m 30s");
    assert.equal(fmtUptime(3900), "1h 5m");
    assert.equal(fmtUptime(90_000), "1d 1h");
    assert.equal(fmtUptime(-5), "0s", "negative uptime must not go negative");
  });
});
