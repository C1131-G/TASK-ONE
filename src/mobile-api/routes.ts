import { Schema } from "effect";

export const MeSchema = Schema.Struct({
  clientCompanyId: Schema.NullOr(Schema.String),
  id: Schema.String,
  mustChangePassword: Schema.Boolean,
  name: Schema.String,
  role: Schema.Literals(["admin", "employee", "client"]),
  timeZone: Schema.NullOr(Schema.String),
});

export type MobileMe = typeof MeSchema.Type;

export type HttpMethod = "get" | "post" | "patch" | "delete";

// One entry per route file under app/api/v1. The OpenAPI document and the
// typed client are both read from this list, and a test fails when a route
// file and its entry drift apart.
export interface RouteDefinition {
  readonly operationId: string;
  readonly method: HttpMethod;
  // The public path, with `{name}` for dynamic segments.
  readonly path: string;
  readonly summary: string;
  // Shape of `data` in a successful response.
  readonly data: Schema.Constraint;
}

export const mobileRoutes = [
  {
    data: MeSchema,
    method: "get",
    operationId: "getMe",
    path: "/api/v1/me",
    summary: "Who the bearer token belongs to.",
  },
] as const satisfies readonly RouteDefinition[];

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

export const FailureSchema = Schema.Struct({
  error: Schema.Struct({
    code: Schema.Literals(ERROR_CODES),
    fieldErrors: Schema.optional(Schema.Record(Schema.String, Schema.String)),
    message: Schema.String,
    requestId: Schema.String,
  }),
  ok: Schema.Literal(false),
});
