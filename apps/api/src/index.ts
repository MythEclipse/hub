/**
 * Type-only barrel. The web app imports `AppRouter` from here (types only) so
 * its oRPC client is fully typed without pulling in server runtime code.
 */
export type { AppRouter } from "./presentation/routers/index.ts";
