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
   * The published key. Not a secret: this endpoint is deliberately open so
   * visitors can call the same router that serves the dashboard reading, and
   * the key is meant to be handed out. It lives here as the default so the
   * credentials block works on a host with no configuration at all — making it
   * a required Bitwarden secret would mean the one thing the page exists to
   * publish is missing until someone remembers to inject it.
   *
   * Rotate by changing this default (or `hub_LLM_ROUTER_API_KEY` in the
   * environment, which wins).
   */
  LLM_ROUTER_API_KEY: z
    .string()
    .min(1)
    .default("sk-5281d60771dcd653-qqmle7-a599e66e"),
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
