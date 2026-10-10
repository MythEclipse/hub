export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "INTERNAL_ERROR";

/** Typed application error; the oRPC layer maps `code` onto its own error type. */
export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AppError";
  }
}

export const notFound = (message: string) => new AppError("NOT_FOUND", message);
export const internalError = (message: string) =>
  new AppError("INTERNAL_ERROR", message);
