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

export const accountRoutes = [
  {
    data: MeSchema,
    method: "get",
    operationId: "getMe",
    path: "/api/v1/me",
    summary: "Who the bearer token belongs to.",
  },
] as const satisfies readonly RouteDefinition[];
