import type { UseCases } from "../../application/use-cases.ts";
import { buildDashboardRouter } from "./dashboard.ts";
import { buildHealthRouter } from "./health.ts";

export function buildRouter(useCases: UseCases) {
  return {
    health: buildHealthRouter(),
    dashboard: buildDashboardRouter(useCases.dashboard),
  };
}

export type AppRouter = ReturnType<typeof buildRouter>;
