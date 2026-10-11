import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fmtBytes,
  fmtUptime,
  gaugeTone,
  reading,
  safeDur,
  serviceTone,
  withTotal,
} from "./format.ts";

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

describe("gaugeTone", () => {
  it("reports no data as neutral, never as healthy", () => {
    // Pass is the healthy signal; null used to render in it, which made a
    // scrape outage indistinguishable from a quiet host.
    assert.notEqual(gaugeTone(null), gaugeTone(0));
    assert.equal(gaugeTone(null), "none");
  });

  it("switches to pending over 60 and fail over 80", () => {
    assert.equal(gaugeTone(60), gaugeTone(0));
    assert.notEqual(gaugeTone(60.1), gaugeTone(60));
    assert.notEqual(gaugeTone(80.1), gaugeTone(60.1));
  });
});

describe("serviceTone", () => {
  it("marks only running services as passing", () => {
    assert.equal(serviceTone("running"), "pass");
    assert.notEqual(serviceTone("failed"), "pass");
  });

  it("treats every non-running state as the same finding", () => {
    // An unreachable or failed unit is one thing to a reader scanning a
    // column; splitting it into several colours would make the column harder
    // to read, not easier.
    assert.equal(serviceTone("failed"), serviceTone("activating"));
    assert.equal(serviceTone("failed"), serviceTone("deactivating"));
  });
});

describe("reading", () => {
  it("never renders a missing value as a number", () => {
    assert.equal(
      reading(null, (v) => `${v}%`),
      "—",
    );
    assert.equal(
      reading(0, (v) => `${v}%`),
      "0%",
    );
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

describe("fmtBytes", () => {
  it("scales into a unit a reader compares against", () => {
    assert.equal(fmtBytes(512), "512 B");
    assert.equal(fmtBytes(1536), "1.5 KB");
    assert.equal(fmtBytes(123_690_532_864), "115 GB");
    assert.equal(fmtBytes(16_763_211_776), "16 GB");
  });

  it("renders an unanswered query as the null glyph, never 0 B", () => {
    assert.equal(fmtBytes(null), "—");
  });
});

describe("withTotal", () => {
  const pct = (v: number) => `${v.toFixed(1)}%`;

  it("gives a percentage its denominator", () => {
    const r = withTotal(81.9, 101_320_409_088, 123_690_532_864, pct);
    assert.equal(r.value, "81.9%");
    assert.equal(r.total, "94 GB / 115 GB");
  });

  it("keeps the figure but drops the annotation when the total is missing", () => {
    // A true reading should not disappear because its denominator is missing.
    const r = withTotal(81.9, null, null, pct);
    assert.equal(r.value, "81.9%");
    assert.equal(r.total, null);
  });

  it("never pairs a real total with a missing used figure", () => {
    const r = withTotal(50, null, 123_690_532_864, pct);
    assert.equal(r.total, null);
  });

  it("renders both parts as the null glyph when nothing was scraped", () => {
    const r = withTotal(null, null, null, pct);
    assert.equal(r.value, "—");
    assert.equal(r.total, null);
  });
});
