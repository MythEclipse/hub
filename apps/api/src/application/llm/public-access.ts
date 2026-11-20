import type { PublicAccess } from "../../domain/llm/public-access.ts";

/**
 * Builds the credentials block the portfolio publishes.
 *
 * The `curl` is assembled from the same fields that are rendered beside it, so
 * a rotated key or a renamed model cannot leave the example pointing at a
 * request that no longer works. The example is the one the owner verified
 * against the router, and it is the shortest thing that proves the key works.
 */
export function buildPublicAccess(config: {
  baseUrl: string;
  model: string;
  apiKey: string;
}): PublicAccess {
  const { baseUrl, model, apiKey } = config;

  // JSON.stringify, not a template: the body is data, and hand-formatting it
  // is how a quote ends up unescaped in a string a visitor is told to paste.
  const body = JSON.stringify({
    model,
    messages: [{ role: "user", content: "Halo" }],
  });

  const curl = [
    `curl -X POST "${baseUrl}/chat/completions" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "Authorization: Bearer ${apiKey}" \\`,
    `  -d '${body}'`,
  ].join("\n");

  return { baseUrl, model, apiKey, curl };
}
