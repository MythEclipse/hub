import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4003),
  PROMETHEUS_URL: z.string().url().default("http://127.0.0.1:9090"),
  GITHUB_REPO_URL: z
    .string()
    .url()
    .default("https://github.com/asepharyana/hub"),
  /**
   * The 9router deployment, OpenAI-compatible base URL. The trailing slash is
   * stripped below because every caller appends `/chat/completions` and a
   * double slash is a 404 on some proxies.
   */
  LLM_ROUTER_URL: z.string().url().default("https://ai.asepharyana.my.id/v1"),
  /** Model id sent with every probe and shown in the published example. */
  LLM_ROUTER_MODEL: z.string().min(1).default("free"),
  /**
   * Key the dashboard probes with, and the same key the portfolio publishes.
   *
   * Optional so the API still boots on a host without it: telemetry then reads
   * as unreachable instead of the process refusing to start over a monitoring
   * credential. The public credentials block is omitted in that case rather
   * than publishing an empty bearer token.
   */
  LLM_ROUTER_API_KEY: z.string().min(1).optional(),
  /** Absolute path to the built SPA. When unset, the API serves RPC only. */
  WEB_DIST_PATH: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(
        (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
      )
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return {
    ...parsed.data,
    LLM_ROUTER_URL: parsed.data.LLM_ROUTER_URL.replace(/\/+$/, ""),
  };
}

export const env = loadEnv();
