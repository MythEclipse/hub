import {
  type GetOverviewDeps,
  makeGetOverview,
} from "./dashboard/get-overview.ts";

export interface Dependencies
  extends Omit<GetOverviewDeps, "units" | "webUnits" | "staticLinks"> {}

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
  config: Omit<GetOverviewDeps, keyof Dependencies>,
): UseCases {
  return {
    dashboard: {
      getOverview: makeGetOverview({ ...deps, ...config }),
    },
  };
}
