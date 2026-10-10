import { os } from "@orpc/server";
import { AppError } from "../../application/shared/errors.ts";
import type { ORPCContext } from "./context.ts";
import { toORPCError } from "./error-mapping.ts";

/**
 * Base procedure. Translates typed application errors into ORPCError so no
 * handler has to know about the error-mapping table.
 */
export const publicProcedure = os
  .$context<ORPCContext>()
  .use(async ({ next }) => {
    try {
      return await next();
    } catch (error) {
      if (error instanceof AppError) {
        throw toORPCError(error);
      }
      throw error;
    }
  });
