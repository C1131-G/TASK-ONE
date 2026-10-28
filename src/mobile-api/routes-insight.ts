import { Schema } from "effect";

import type { RouteDefinition } from "./route-definition";
import { NextCursorSchema, PageQuerySchema } from "./routes-paging";

// Read-only views over the workspace: the activity feed and team workload.
// Owned by one branch, so adding routes here never conflicts with the others.
// This file imports nothing from the server, so every shape is spelled out here
// and a test decodes real responses against it.

const ActivityRow = Schema.Struct({
  action: Schema.String,
  actorId: Schema.String,
  actorName: Schema.String,
  createdAt: Schema.String,
  id: Schema.String,
  projectId: Schema.NullOr(Schema.String),
  projectName: Schema.NullOr(Schema.String),
  taskId: Schema.NullOr(Schema.String),
  taskTitle: Schema.NullOr(Schema.String),
});

export const ActivityPage = Schema.Struct({
  items: Schema.Array(ActivityRow),
  nextCursor: NextCursorSchema,
});

export const activityListRoute = {
  data: ActivityPage,
  method: "get",
  operationId: "listActivity",
  path: "/api/v1/workspace/activity",
  query: PageQuerySchema,
  summary:
    "The workspace's most recent activity, newest first, one page at a time. The feed reaches back over the latest 100 entries.",
} as const satisfies RouteDefinition;

const WorkloadWeek = Schema.Struct({
  loadHours: Schema.Number,
  overloaded: Schema.Boolean,
  taskCount: Schema.Number,
  weekStart: Schema.String,
});

const WorkloadPerson = Schema.Struct({
  name: Schema.String,
  overdueCount: Schema.Number,
  overloadedWeekCount: Schema.Number,
  peakLoadHours: Schema.Number,
  unscheduled: Schema.Struct({
    loadHours: Schema.Number,
    taskCount: Schema.Number,
  }),
  userId: Schema.String,
  weeks: Schema.Array(WorkloadWeek),
});

export const WorkloadView = Schema.Struct({
  capacityHours: Schema.Number,
  people: Schema.Array(WorkloadPerson),
  weeks: Schema.Array(Schema.String),
});

export const workloadRoute = {
  data: WorkloadView,
  method: "get",
  operationId: "listWorkload",
  path: "/api/v1/workspace/workload",
  summary:
    "Each person's open work over the coming weeks, in hours against the weekly capacity.",
} as const satisfies RouteDefinition;

export const insightRoutes = [
  activityListRoute,
  workloadRoute,
] as const satisfies readonly RouteDefinition[];
