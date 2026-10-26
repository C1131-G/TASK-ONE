import { Schema } from "effect";

import type { MobileRouteDefinition } from "./route-definition";
import { ProjectSummarySchema } from "./workspace";

export const portalRoutes = [
  {
    data: Schema.Struct({ projects: Schema.Array(ProjectSummarySchema) }),
    method: "get",
    operationId: "listPortalProjects",
    path: "/api/v1/portal/projects",
    summary: "Lists the client's projects with progress.",
  },
] as const satisfies readonly MobileRouteDefinition[];
