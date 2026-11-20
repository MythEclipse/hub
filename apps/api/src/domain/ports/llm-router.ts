/**
 * A live measurement of the LLM router.
 *
 * The dashboard used to read `llm_api_*` from Prometheus. Those series no
 * longer exist on the host, so the whole ROUTER block rendered as `—`: four
 * nulls that looked like a quiet router rather than an unanswered query. The
 * replacement is the only source that cannot go stale — the router itself,
 * called and timed.
 *
 * Domain layer: no fetch, no framework. The HTTP call lives in infrastructure.
 */

/** One completed probe. A failed probe is a sample too: it is the evidence. */
export interface LlmProbeSample {
  /** Whether the router answered with a usable completion. */
  ok: boolean;
  /**
   * Round-trip for the whole completion, in ms, or null when the call failed.
   * End-to-end rather than time-to-first-token, so it is an upper bound on
   * what a caller waits for.
   */
  latencyMs: number | null;
  /** Model id the router answered with, or null when the call failed. */
  model: string | null;
  /**
   * Completion tokens per second, or null when the call failed.
   *
   * Measured as `usage.completion_tokens / latency`, so it includes the time
   * spent waiting for the first token and understates steady-state throughput.
   * It is a floor, and the sheet labels it as a speed, not a benchmark.
   */
  tokSpeed: number | null;
  /** Epoch ms the probe finished, so the UI can say how old the reading is. */
  checkedAt: number;
}

export interface LlmRouterProbe {
  /** Never throws: a failure is a sample with `ok: false`. */
  probe(): Promise<LlmProbeSample>;
}

/** Where the router lives. One value set feeds both the probe and the public page. */
export interface LlmRouterConfig {
  /** OpenAI-compatible base URL, no trailing slash (e.g. `https://host/v1`). */
  baseUrl: string;
  model: string;
  apiKey: string;
}
