import { publicProcedure } from "../orpc/middleware.ts";

export function buildHealthRouter() {
  return {
    ping: publicProcedure.handler(() => ({ status: "ok" as const })),
  };
}
