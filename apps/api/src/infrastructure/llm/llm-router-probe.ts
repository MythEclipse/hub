import type {
  LlmProbeSample,
  LlmRouterConfig,
  LlmRouterProbe,
} from "../../domain/ports/llm-router.ts";

/**
 * Calls the router's OpenAI-compatible chat endpoint and times it.
 *
 * The probe asks for a single short completion on purpose. It is a liveness and
 * latency check, not a benchmark: the tokens-per-second figure it derives
 * includes the wait for the first token, so a router that thinks before it
 * answers reads slow here even when its steady-state throughput is fine. That
 * is the honest number for this dashboard, because the wait is what a visitor
 * experiences.
 */

/** A probe is a network round-trip; a hung router must not pin a request. */
const PROBE_TIMEOUT_MS = 20_000;

/**
 * Small enough that the probe stays cheap, large enough that a reasoning model
 * still emits something countable. A router that spends its whole budget on
 * hidden reasoning tokens reports a low speed, which is a true reading.
 */
const PROBE_MAX_TOKENS = 16;

const PROBE_PROMPT = "Reply with the single word: ok";

interface CompletionResponse {
  model?: unknown;
  usage?: { completion_tokens?: unknown };
  choices?: unknown;
}

export function createLlmRouterProbe(config: LlmRouterConfig): LlmRouterProbe {
  const endpoint = `${config.baseUrl}/chat/completions`;

  return {
    async probe(): Promise<LlmProbeSample> {
      const startedAt = Date.now();

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages: [{ role: "user", content: PROBE_PROMPT }],
            max_tokens: PROBE_MAX_TOKENS,
          }),
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });

        const latencyMs = Date.now() - startedAt;

        if (!response.ok) {
          // A 401/403 is the case that matters operationally: the key was
          // rotated or revoked, and the dashboard should say the router is
          // unreachable rather than keep showing a green lamp.
          return failed(undefined, Date.now());
        }

        const body = (await response.json()) as CompletionResponse;
        const completionTokens = toNumber(body.usage?.completion_tokens);

        // A 200 with no choices is not a working router — a proxy error page or
        // an empty body would otherwise be recorded as healthy at 0 tok/s.
        if (!hasChoices(body)) return failed(body, Date.now());

        return {
          ok: true,
          latencyMs,
          model: typeof body.model === "string" ? body.model : config.model,
          tokSpeed:
            completionTokens && completionTokens > 0
              ? round(completionTokens / (latencyMs / 1000))
              : null,
          checkedAt: Date.now(),
        };
      } catch {
        // Timeout, DNS failure, TLS error, invalid JSON: all one outcome here.
        return failed(undefined, Date.now());
      }
    },
  };
}

function failed(body: CompletionResponse | undefined, checkedAt: number) {
  return {
    ok: false,
    latencyMs: null,
    // Even a failed call can name the model it failed on, which is worth
    // showing: "free is unreachable" is a more useful line than "unreachable".
    model: typeof body?.model === "string" ? body.model : null,
    tokSpeed: null,
    checkedAt,
  } satisfies LlmProbeSample;
}

function hasChoices(body: CompletionResponse): boolean {
  return Array.isArray(body.choices) && body.choices.length > 0;
}

function toNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Two decimals: a router does not report speed to six. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
