import {
  type GetOverviewDeps,
  makeGetOverview,
} from "./dashboard/get-overview.ts";
import type { LlmTelemetry } from "./llm/llm-telemetry.ts";

/** What the use-cases need injected. Config (`staticLinks`, `publicAccess`) is separate. */
export interface Dependencies {
  systemd: GetOverviewDeps["systemd"];
  prometheus: GetOverviewDeps["prometheus"];
  llm: LlmTelemetry;
}

/** Everything the overview needs that is configuration rather than a dependency. */
export type OverviewConfig = Pick<
  GetOverviewDeps,
  "staticLinks" | "publicAccess"
>;

export interface UseCases {
  dashboard: {
    getOverview: ReturnType<typeof makeGetOverview>;
  };
}

/**
 * Single place where use-cases are constructed. The presentation layer receives
 * only this object, so it can never reach the database or cache directly.
 */
export function buildUseCases(
  deps: Dependencies,
  config: OverviewConfig,
): UseCases {
  return {
    dashboard: {
      getOverview: makeGetOverview({ ...deps, ...config }),
    },
  };
}
