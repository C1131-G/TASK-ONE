import { randomUUID } from "node:crypto";

import { Cause, Data, Effect, Exit } from "effect";
import { io } from "next/cache";

import { logger } from "./logger";

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UNAVAILABLE";

export class AppError extends Data.TaggedError("AppError")<{
  readonly code: AppErrorCode;
  readonly message: string;
  readonly details?: unknown;
}> {}

export type ActionResult<Result> =
  | { readonly ok: true; readonly data: Result; readonly requestId: string }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: AppErrorCode;
        readonly message: string;
        readonly requestId: string;
      };
    };

const safeFailure = (requestId: string): ActionResult<never> => ({
  error: {
    code: "UNAVAILABLE",
    message: "The request could not be completed.",
    requestId,
  },
  ok: false,
});

export const runEffectResult = async <Result, ErrorType>(
  program: Effect.Effect<Result, ErrorType>,
  requestId?: string
): Promise<ActionResult<Result>> => {
  await io();
  const resolvedRequestId = requestId ?? randomUUID();
  const exit = await Effect.runPromiseExit(program);

  if (Exit.isSuccess(exit)) {
    return { data: exit.value, ok: true, requestId: resolvedRequestId };
  }

  const failure = Cause.findErrorOption(exit.cause);
  if (failure._tag === "Some" && failure.value instanceof AppError) {
    return {
      error: {
        code: failure.value.code,
        message: failure.value.message,
        requestId: resolvedRequestId,
      },
      ok: false,
    };
  }

  // Defects and untyped failures are bugs: the caller only sees the request
  // ID, so the full cause must reach the logs under that same ID.
  logger.error("Unexpected failure while running an action.", {
    cause: Cause.pretty(exit.cause),
    error: Cause.squash(exit.cause),
    requestId: resolvedRequestId,
  });
  return safeFailure(resolvedRequestId);
};
