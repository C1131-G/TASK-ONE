import { Schema } from "effect";

import type { RouteDefinition } from "./route-definition";

export const MeSchema = Schema.Struct({
  clientCompanyId: Schema.NullOr(Schema.String),
  id: Schema.String,
  mustChangePassword: Schema.Boolean,
  name: Schema.String,
  role: Schema.Literals(["admin", "employee", "client"]),
  timeZone: Schema.NullOr(Schema.String),
});

export type MobileMe = typeof MeSchema.Type;

// Long enough for any real password, short enough that nobody makes the server
// hash a megabyte of text.
const PasswordText = Schema.String.check(Schema.isMaxLength(1024));

export const changePasswordRoute = {
  body: Schema.Struct({
    currentPassword: PasswordText,
    newPassword: PasswordText,
  }),
  data: Schema.Struct({ changed: Schema.Boolean }),
  // A password must never be stored for replay.
  idempotency: "none",
  method: "post",
  operationId: "changePassword",
  path: "/api/v1/me/password",
  summary:
    "Replace the caller's password, which also ends their other sessions. Open to an account that must change its password first.",
} as const satisfies RouteDefinition;

export const getMeRoute = {
  data: MeSchema,
  method: "get",
  operationId: "getMe",
  path: "/api/v1/me",
  summary: "Who the bearer token belongs to.",
} as const satisfies RouteDefinition;

export const accountRoutes = [
  getMeRoute,
  changePasswordRoute,
] as const satisfies readonly RouteDefinition[];
