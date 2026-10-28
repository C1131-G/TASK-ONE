import { Schema } from "effect";

import type { MobileRouteDefinition } from "./route-definition";
import { BugSummarySchema, ProjectSummarySchema } from "./workspace";

export const portalRoutes = [
  {
    body: Schema.Struct({
      description: Schema.String,
      projectId: Schema.String,
      title: Schema.String,
    }),
    data: Schema.Struct({ id: Schema.String }),
    method: "post",
    operationId: "createPortalBug",
    path: "/api/v1/portal/bugs",
    summary: "Reports a new bug; requires an idempotency key.",
  },
] as const satisfies readonly MobileRouteDefinition[];
