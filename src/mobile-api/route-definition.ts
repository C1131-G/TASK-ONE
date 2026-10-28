import { Schema } from "effect";

export type HttpMethod = "get" | "post" | "patch" | "delete";

// One entry per route file under app/api/v1. The OpenAPI document and the
// typed client are both read from the route list, and a test fails when a
// route file and its entry drift apart.
export interface RouteDefinition {
  readonly operationId: string;
  readonly method: HttpMethod;
  // The public path, with `{name}` for dynamic segments.
  readonly path: string;
  readonly summary: string;
  // Shape of `data` in a successful response.
  readonly data: Schema.Constraint;
  // The `{name}` segments of the path, each decoded from text.
  readonly params?: Schema.Constraint;
  // Query-string fields, each decoded from text.
  readonly query?: Schema.Constraint;
  // The JSON request body of a write.
  readonly body?: Schema.Constraint;
  // A write is safe to retry by default and needs an `Idempotency-Key`. A write
  // that hands out a signed URL or a credential must never be stored for
  // replay, so it declares `"none"` and neither asks for nor documents a key.
  readonly idempotency?: "none";
}

// What a caller supplies for a route: its decoded path, query and body, plus
// the key that makes a write safe to retry.
export type RouteInput<Route extends RouteDefinition> = (Route extends {
  readonly params: infer Params extends Schema.Constraint;
}
  ? { readonly params: Params["Type"] }
  : unknown) &
  (Route extends { readonly query: infer Query extends Schema.Constraint }
    ? { readonly query: Query["Type"] }
    : unknown) &
  (Route extends { readonly body: infer Body extends Schema.Constraint }
    ? { readonly body: Body["Type"] }
    : unknown) &
  (Route["method"] extends "get"
    ? unknown
    : Route extends { readonly idempotency: "none" }
      ? unknown
      : { readonly idempotencyKey: string });

export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_FAILED",
  "CONFLICT",
  "RATE_LIMITED",
  "UNAVAILABLE",
] as const;

export type AppErrorCode = (typeof ERROR_CODES)[number];

export const UNAUTHENTICATED_REASONS = [
  "session_ended",
  "deactivated",
  "inactivity",
] as const;

export type UnauthenticatedReason = (typeof UNAUTHENTICATED_REASONS)[number];

export const FailureSchema = Schema.Struct({
  error: Schema.Struct({
    code: Schema.Literals(ERROR_CODES),
    fieldErrors: Schema.optional(Schema.Record(Schema.String, Schema.String)),
    message: Schema.String,
    // On 401: why. `session_ended` also covers expired and revoked sessions.
    reason: Schema.optional(Schema.Literals(UNAUTHENTICATED_REASONS)),
    requestId: Schema.String,
    // On 429: seconds to wait; the same value is in the Retry-After header.
    retryAfterSeconds: Schema.optional(Schema.Number),
  }),
  ok: Schema.Literal(false),
});
