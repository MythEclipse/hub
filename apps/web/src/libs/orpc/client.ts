import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouter } from "#api/index";

/**
 * Type-only imports: the web app never imports API runtime code, it only
 * inherits the procedure signatures. `RouterClient` is oRPC's router-to-client
 * mapper — assigning it here is what makes `queryOptions()` and the data
 * returned by `useQuery` fully typed against the server contract.
 */
export type { AppRouter };
export type AppRouterClient = RouterClient<AppRouter>;

// RPCLink resolves the URL with `new URL(...)`, so it must be ABSOLUTE — a
// bare "/rpc" throws "Invalid URL" before any request is made.
//
// Dev: Vite proxies /rpc to the Hono process (see vite.config.ts), so pointing
// at the dev origin stays same-origin and needs no CORS.
// Prod: Hono serves the SPA and the API from this same origin.
const API_BASE = import.meta.env.VITE_API_URL ?? window.location.origin;

const link = new RPCLink({
  url: `${API_BASE}/rpc`,
  fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
});

export const client: AppRouterClient = createORPCClient(link);
export const orpc = createTanstackQueryUtils(client);
