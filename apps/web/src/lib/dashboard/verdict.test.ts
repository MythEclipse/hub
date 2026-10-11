import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sheetVerdict } from "./verdict.ts";

const t = {
  unreachable: "API unreachable",
  noServices: "No services reported",
  degraded: "degraded",
  aboveThreshold: "above threshold",
  allOperational: "All systems operational",
};

describe("sheetVerdict", () => {
  it("reports an unreachable API as a failure, not an idle host", () => {
    const v = sheetVerdict(
      { error: true, services: 0, degraded: 0, load: [] },
      t,
    );
    assert.equal(v.text, t.unreachable);
    assert.equal(v.tone, "fail");
  });

  it("reports an empty service list as pending rather than healthy", () => {
    const v = sheetVerdict(
      { error: false, services: 0, degraded: 0, load: [] },
      t,
    );
    assert.equal(v.text, t.noServices);
    assert.notEqual(v.tone, "pass");
  });

  it("counts degraded units first", () => {
    const v = sheetVerdict(
      { error: false, services: 29, degraded: 2, load: [91] },
      t,
    );
    assert.equal(v.text, `2 ${t.degraded}`);
  });

  /**
   * Regression from the first inspection round: every service was running
   * while disk sat at 81%, and the header still claimed "all systems
   * operational". A verdict its own readings can contradict is not a verdict.
   */
  it("refuses to call a host normal while a reading is above threshold", () => {
    const v = sheetVerdict(
      { error: false, services: 29, degraded: 0, load: [14, 57, 81.2] },
      t,
    );
    assert.notEqual(v.text, t.allOperational);
    assert.equal(v.text, `1 ${t.aboveThreshold}`);
    assert.equal(v.tone, "pending");
  });

  it("ignores readings that were never scraped", () => {
    // null means "could not measure", which is not the same as "measured high"
    // and must not drag the verdict toward an alarm.
    const v = sheetVerdict(
      {
        error: false,
        services: 29,
        degraded: 0,
        load: [null, null, undefined],
      },
      t,
    );
    assert.equal(v.text, t.allOperational);
    assert.equal(v.tone, "pass");
  });

  it("calls a host normal only when nothing is failing", () => {
    const v = sheetVerdict(
      { error: false, services: 29, degraded: 0, load: [14, 57, 61] },
      t,
    );
    assert.equal(v.text, t.allOperational);
    assert.equal(v.tone, "pass");
  });
});
