import { Schema } from "effect";

import type { MobileRouteDefinition } from "./route-definition";
import { BugSummarySchema, ProjectSummarySchema } from "./workspace";

export const portalRoutes = [
  {
    data: Schema.Struct({ projects: Schema.Array(ProjectSummarySchema) }),
    method: "get",
    operationId: "listPortalProjects",
    path: "/api/v1/portal/projects",
    summary: "Lists the client's projects with progress.",
  },
  {
    data: Schema.Struct({ bugs: Schema.Array(BugSummarySchema) }),
    method: "get",
    operationId: "listPortalBugs",
    path: "/api/v1/portal/bugs",
    summary: "Lists the client's reported bugs.",
  },
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
