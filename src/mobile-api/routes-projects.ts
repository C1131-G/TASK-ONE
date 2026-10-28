import { Schema } from "effect";

import type { RouteDefinition } from "./route-definition";
import { NextCursorSchema, PageQuerySchema } from "./routes-paging";

// Project lists: the workspace's projects and budgets, and a client's projects.
// Owned by one branch, so adding routes here never conflicts with the others.
// This file imports nothing from the server, so every shape is spelled out here
// and a test decodes real responses against it.

const ProjectStatus = Schema.Literals([
  "planning",
  "active",
  "risk",
  "hold",
  "complete",
]);

const ProjectRow = Schema.Struct({
  clientVisible: Schema.Boolean,
  dueDate: Schema.NullOr(Schema.String),
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
  openTaskCount: Schema.Number,
  overdueTaskCount: Schema.Number,
  progress: Schema.Number,
  status: ProjectStatus,
  taskCount: Schema.Number,
});

export const ProjectPage = Schema.Struct({
  items: Schema.Array(ProjectRow),
  nextCursor: NextCursorSchema,
});

export const projectListRoute = {
  data: ProjectPage,
  method: "get",
  operationId: "listProjects",
  path: "/api/v1/workspace/projects",
  query: PageQuerySchema,
  summary:
    "The workspace's active projects with their task counts and progress, one page at a time.",
} as const satisfies RouteDefinition;

const BudgetRow = Schema.Struct({
  billableOnly: Schema.Boolean,
  budgetAmountCents: Schema.NullOr(Schema.Number),
  budgetMinutes: Schema.Number,
  currency: Schema.String,
  hourlyRateCents: Schema.NullOr(Schema.Number),
  kind: Schema.Literals(["one_off", "retainer"]),
  level: Schema.Literals(["ok", "warning", "overrun"]),
  percent: Schema.Number,
  period: Schema.Struct({
    from: Schema.NullOr(Schema.String),
    key: Schema.String,
    to: Schema.NullOr(Schema.String),
  }),
  projectId: Schema.String,
  projectKey: Schema.String,
  projectName: Schema.String,
  remainingMinutes: Schema.Number,
  spentAmountCents: Schema.NullOr(Schema.Number),
  spentMinutes: Schema.Number,
  warningPercent: Schema.Number,
});

export const BudgetPage = Schema.Struct({
  items: Schema.Array(BudgetRow),
  nextCursor: NextCursorSchema,
});

export const budgetListRoute = {
  data: BudgetPage,
  method: "get",
  operationId: "listBudgets",
  path: "/api/v1/workspace/budgets",
  query: PageQuerySchema,
  summary:
    "Each project's time budget with what has been spent and its alert level, one page at a time.",
} as const satisfies RouteDefinition;

const PortalProjectRow = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
});

export const PortalProjectPage = Schema.Struct({
  items: Schema.Array(PortalProjectRow),
  nextCursor: NextCursorSchema,
});

export const portalProjectListRoute = {
  data: PortalProjectPage,
  method: "get",
  operationId: "listPortalProjects",
  path: "/api/v1/portal/projects",
  query: PageQuerySchema,
  summary: "The projects shared with the client's company, one page at a time.",
} as const satisfies RouteDefinition;

export const projectRoutes = [
  projectListRoute,
  budgetListRoute,
  portalProjectListRoute,
] as const satisfies readonly RouteDefinition[];
