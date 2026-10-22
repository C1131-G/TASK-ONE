import { Effect, Layer } from "effect";

import type { AppError } from "../core/action-result";
import { IntakeObjectStoreLive } from "./intake-object-store";
import { IntakeSubmissions, IntakeSubmissionsLive } from "./intake-submissions";

// Shared by the two public intake routes: bounded body reads, one JSON error
// shape, and the service wiring.

const RATE_LIMIT_RETRY_SECONDS = 3600;

const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
} as const;

export const json = (
  status: number,
  body: unknown,
  extra: Record<string, string> = {}
): Response =>
  Response.json(body, {
    headers: { ...JSON_HEADERS, ...extra },
    status,
  });

export const failureResponse = (
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {}
): Response => json(status, { error: { code, message, ...extra } }, headers);

// One unmistakable answer for every form that cannot take a report, so a
// caller cannot tell an unknown slug from a disabled form.
export const notFoundResponse = (): Response =>
  failureResponse(404, "NOT_FOUND", "This form is not available.");

export const appErrorResponse = (error: AppError): Response => {
  switch (error.code) {
    case "NOT_FOUND": {
      return notFoundResponse();
    }
    case "VALIDATION_FAILED": {
      return failureResponse(
        422,
        error.code,
        error.message,
        error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}
      );
    }
    case "RATE_LIMITED": {
      return failureResponse(
        429,
        error.code,
        error.message,
        {},
        { "retry-after": String(RATE_LIMIT_RETRY_SECONDS) }
      );
    }
    default: {
      return failureResponse(
        503,
        "UNAVAILABLE",
        "The report could not be saved. Try again later.",
        {},
        { "retry-after": "60" }
      );
    }
  }
};

export const declaredLength = (request: Request): number | null => {
  const header = request.headers.get("content-length");
  if (!header || !/^\d+$/u.test(header)) {
    return null;
  }
  return Number(header);
};

// Reads at most `limit` bytes of the body. Returns null when the body is
// larger, whatever the declared length claims.
export const readBoundedBytes = async (
  request: Request,
  limit: number
): Promise<Uint8Array<ArrayBuffer> | null> => {
  const declared = declaredLength(request);
  if (declared !== null && declared > limit) {
    return null;
  }
  if (!request.body) {
    return new Uint8Array();
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    // Chunks must be read in order and counted as they arrive.
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > limit) {
      // eslint-disable-next-line no-await-in-loop
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

export const IntakeRuntimeLive = Layer.provide(
  IntakeSubmissionsLive,
  IntakeObjectStoreLive
);

export type IntakeOutcome<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: AppError };

export const runIntake = <Value>(
  program: (
    service: typeof IntakeSubmissions.Service
  ) => Effect.Effect<Value, AppError>
): Promise<IntakeOutcome<Value>> =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* withIntake() {
        return yield* program(yield* IntakeSubmissions);
      }).pipe(
        Effect.match({
          onFailure: (error) => ({ error, ok: false as const }),
          onSuccess: (value) => ({ ok: true as const, value }),
        })
      ),
      IntakeRuntimeLive
    )
  );
