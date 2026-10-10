import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4003),
  PROMETHEUS_URL: z.string().url().default("http://127.0.0.1:9090"),
  GITHUB_REPO_URL: z
    .string()
    .url()
    .default("https://github.com/asepharyana/hub"),
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

  return parsed.data;
}

export const env = loadEnv();
