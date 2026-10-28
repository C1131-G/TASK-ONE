import { randomUUID } from "node:crypto";

import type { Effect } from "effect";

import { runEffectResult } from "../core/action-result";
import type { AppErrorCode } from "../core/action-result";
import { logger } from "../core/logger";
import { withRequestRecord } from "./request-log";

export const REQUEST_ID_HEADER = "x-request-id";

const STATUS_BY_CODE: Readonly<Record<AppErrorCode, number>> = {
  CONFLICT: 409,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UNAUTHENTICATED: 401,
  UNAVAILABLE: 503,
  VALIDATION_FAILED: 422,
};

// Runs a service program and answers with the same `{ ok, data | error,
// requestId }` body the web actions return, plus the request ID as a header
// so a support report can name one request. Every request leaves one log line
// under that ID.
export const respondWith = async <Result, ErrorType>(
  program: Effect.Effect<Result, ErrorType>,
  requestId: string = randomUUID()
): Promise<Response> => {
  const startedAt = performance.now();
  const { record, value: result } = await withRequestRecord(() =>
    runEffectResult(program, requestId)
  );
  const status = result.ok ? 200 : STATUS_BY_CODE[result.error.code];
  logger.info("Mobile API request", {
    ...record,
    ...(result.ok ? {} : { code: result.error.code }),
    durationMs: Math.round(performance.now() - startedAt),
    requestId,
    status,
  });
  const retryAfter = result.ok ? undefined : result.error.retryAfterSeconds;
  return Response.json(result, {
    headers: {
      [REQUEST_ID_HEADER]: requestId,
      ...(retryAfter === undefined
        ? {}
        : { "retry-after": String(retryAfter) }),
    },
    status,
  });
};
