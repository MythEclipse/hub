import type { UseCases } from "../../application/use-cases.ts";
import { publicProcedure } from "../orpc/middleware.ts";

export function buildDashboardRouter(useCases: UseCases["dashboard"]) {
  return {
    getOverview: publicProcedure.handler(() => useCases.getOverview()),
  };
}
