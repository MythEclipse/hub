import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LlmProbeSample } from "../../domain/ports/llm-router.ts";
import { makeLlmTelemetry } from "./llm-telemetry.ts";

/**
 * The invariants this file protects:
 *
 *  - the dashboard never awaits the router (a poll must not hang on a probe),
 *  - a stale sample is refreshed, a fresh one is not,
 *  - and "no sample yet" stays null rather than reading as reachable.
 */

const okSample = (checkedAt: number): LlmProbeSample => ({
  ok: true,
  latencyMs: 2500,
  model: "free",
  tokSpeed: 3.2,
  checkedAt,
});

describe("makeLlmTelemetry", () => {
  it("reports nulls before the first probe lands", () => {
    const telemetry = makeLlmTelemetry({
      probe: { probe: () => new Promise(() => {}) },
      now: () => 0,
    });

    const reading = telemetry.read();
    assert.equal(reading.reachable, null);
    assert.equal(reading.model, null);
    assert.equal(reading.latencyMs, null);
    assert.equal(reading.tokSpeed, null);
    assert.equal(reading.checkedAt, null);
  });

  it("returns the sample without awaiting the probe in flight", async () => {
    // The whole point of the service: a poll gets an answer immediately, and
    // the network call finishes on its own time. A `read()` that awaited the
    // probe would hold the portfolio hero behind a multi-second round-trip.
    let release: ((s: LlmProbeSample) => void) | undefined;
    const telemetry = makeLlmTelemetry({
      probe: {
        probe: () =>
          new Promise<LlmProbeSample>((resolve) => {
            release = resolve;
          }),
      },
      now: () => 1000,
    });

    const first = telemetry.read();
    assert.equal(first.reachable, null, "read must not block on the probe");

    release?.(okSample(1000));
    await Promise.resolve();
    await Promise.resolve();

    const second = telemetry.read();
    assert.equal(second.reachable, true);
    assert.equal(second.model, "free");
  });

  it("reuses a fresh sample instead of probing on every poll", async () => {
    let calls = 0;
    let clock = 0;
    const telemetry = makeLlmTelemetry({
      probe: {
        probe: async () => {
          calls++;
          return okSample(clock);
        },
      },
      ttlMs: 60_000,
      now: () => clock,
    });

    telemetry.read();
    await Promise.resolve();
    await Promise.resolve();

    // Four polls inside the TTL: one probe.
    for (let i = 0; i < 4; i++) {
      clock += 10_000;
      telemetry.read();
      await Promise.resolve();
      await Promise.resolve();
    }
    assert.equal(calls, 1, "a poll every 10s must not probe every 10s");

    clock += 60_000;
    telemetry.read();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(calls, 2, "a stale sample must be refreshed");
  });

  it("does not start a second probe while one is running", async () => {
    let calls = 0;
    let release: (() => void) | undefined;
    const telemetry = makeLlmTelemetry({
      probe: {
        probe: async () => {
          calls++;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          return okSample(0);
        },
      },
      now: () => 0,
    });

    telemetry.read();
    telemetry.read();
    telemetry.read();
    assert.equal(calls, 1, "three concurrent polls must share one probe");

    release?.();
    await Promise.resolve();
    await Promise.resolve();
  });

  it("records a rejection as an unreachable sample", async () => {
    // The probe contract says it never throws; if it does anyway, the reading
    // must degrade to "unreachable" rather than keep a stale green reading.
    const telemetry = makeLlmTelemetry({
      probe: {
        probe: async () => {
          throw new Error("boom");
        },
      },
      now: () => 500,
    });

    telemetry.read();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const reading = telemetry.read();
    assert.equal(reading.reachable, false);
    assert.equal(reading.latencyMs, null);
    assert.equal(reading.checkedAt, 500);
  });
});
