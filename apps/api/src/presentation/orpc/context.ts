import type { UseCases } from "../../application/use-cases.ts";

/**
 * Context handed to every oRPC procedure. `headers` is the raw request
 * Headers object; there is no session because the app has no auth.
 */
export interface ORPCContext {
  headers: Headers;
  useCases: UseCases;
}

export function buildContext(
  headers: Headers,
  useCases: UseCases,
): ORPCContext {
  return { headers, useCases };
}
