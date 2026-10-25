import { Schema } from "effect";

import type { MobileRouteDefinition } from "./route-definition";

export const BugSummarySchema = Schema.Struct({
  id: Schema.String,
  priority: Schema.Literals(["low", "medium", "high", "urgent"]),
  projectId: Schema.String,
  projectName: Schema.String,
  status: Schema.Literals(["open", "confirmed", "fixed", "rejected"]),
  title: Schema.String,
});

export const ProjectSummarySchema = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
  openTasks: Schema.Number,
  progress: Schema.Number,
});

export const workspaceRoutes = [
  {
    data: Schema.Struct({ bugs: Schema.Array(BugSummarySchema) }),
    method: "get",
    operationId: "listBugs",
    path: "/api/v1/workspace/bugs",
    summary: "Lists the workspace bugs.",
  },
  {
    data: Schema.Struct({ projects: Schema.Array(ProjectSummarySchema) }),
    method: "get",
    operationId: "listProjects",
    path: "/api/v1/workspace/projects",
    summary: "Lists the workspace projects with progress.",
  },
] as const satisfies readonly MobileRouteDefinition[];
