import type { LlmMetrics } from "../../domain/dashboard/dashboard.ts";
import type {
  LlmProbeSample,
  LlmRouterProbe,
} from "../../domain/ports/llm-router.ts";

/**
 * Turns a probe that costs a real network round-trip into a reading the
 * dashboard can ask for on every poll.
 *
 * Three constraints shape this:
 *
 * 1. **The overview must never wait on the router.** A probe takes seconds and
 *    the portfolio's hero reads the same payload, so `read()` returns the last
 *    sample and never awaits a call in flight.
 * 2. **A poll every 15 s must not become a probe every 15 s.** The sample is
 *    reused until `ttlMs` has passed, so the router sees about one call a
 *    minute no matter how many tabs are open.
 * 3. **No sample is not a healthy router.** Before the first probe lands every
 *    field is null, which the sheet renders as `—`. A cold start that claimed
 *    `reachable: true` would be a fabricated reading.
 */

export interface LlmTelemetry {
  /** Last known reading. Never blocks on the network. */
  read(): LlmMetrics;
  /** Starts a probe when the sample is stale and none is running. */
  refresh(): void;
}

const NO_SAMPLE: LlmMetrics = {
  reachable: null,
  model: null,
  latencyMs: null,
  tokSpeed: null,
  checkedAt: null,
};

export interface LlmTelemetryOptions {
  probe: LlmRouterProbe;
  /** How long a sample stays fresh. One probe a minute by default. */
  ttlMs?: number;
  /** Injected for tests; production uses the wall clock. */
  now?: () => number;
}

export function makeLlmTelemetry({
  probe,
  ttlMs = 60_000,
  now = Date.now,
}: LlmTelemetryOptions): LlmTelemetry {
  let last: LlmProbeSample | undefined;
  let inFlight: Promise<void> | undefined;

  function refresh(): void {
    // A probe already running is the freshest thing available; starting a
    // second one would double the load for a sample that lands later anyway.
    if (inFlight) return;
    if (last && now() - last.checkedAt < ttlMs) return;

    inFlight = probe
      .probe()
      .then((sample) => {
        last = sample;
      })
      .catch(() => {
        // The probe contract says it never throws, but a rejection here must
        // not leave the dashboard with a permanently stale "reachable" sample.
        // Recording a failed probe is the honest outcome.
        last = {
          ok: false,
          latencyMs: null,
          model: null,
          tokSpeed: null,
          checkedAt: now(),
        };
      })
      .finally(() => {
        inFlight = undefined;
      });
  }

  function read(): LlmMetrics {
    // Reading is also what keeps the sample fresh: there is no timer to own,
    // and a host nobody is looking at costs no router calls at all.
    refresh();

    if (!last) return NO_SAMPLE;

    return {
      reachable: last.ok,
      model: last.model,
      latencyMs: last.latencyMs,
      tokSpeed: last.tokSpeed,
      checkedAt: last.checkedAt,
    };
  }

  return { read, refresh };
}
