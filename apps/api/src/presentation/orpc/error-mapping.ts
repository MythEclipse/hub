import { ORPCError } from "@orpc/server";
import type {
  AppError,
  AppErrorCode,
} from "../../application/shared/errors.ts";

/**
 * Single source of truth for AppErrorCode -> ORPCError code + HTTP status.
 * Nothing else in the codebase may choose a status for an application error.
 */
const ERROR_MAP: Record<AppErrorCode, { code: string; status: number }> = {
  UNAUTHORIZED: { code: "UNAUTHORIZED", status: 401 },
  FORBIDDEN: { code: "FORBIDDEN", status: 403 },
  NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  BAD_REQUEST: { code: "BAD_REQUEST", status: 400 },
  CONFLICT: { code: "CONFLICT", status: 409 },
  INTERNAL_ERROR: { code: "INTERNAL_ERROR", status: 500 },
};

export function toORPCError(error: AppError): ORPCError<string, unknown> {
  const mapped = ERROR_MAP[error.code];
  return new ORPCError(mapped.code, {
    status: mapped.status,
    message: error.message,
    data: { appErrorCode: error.code },
  });
}
