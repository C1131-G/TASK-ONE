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

export const PersonLoadSchema = Schema.Struct({
  id: Schema.String,
  loadHours: Schema.Number,
  name: Schema.String,
  openTasks: Schema.Number,
  overHours: Schema.Number,
});

export const TimeEntrySchema = Schema.Struct({
  date: Schema.String,
  hours: Schema.Number,
  id: Schema.String,
  projectName: Schema.String,
  taskId: Schema.NullOr(Schema.String),
  taskTitle: Schema.NullOr(Schema.String),
});

export const FileSummarySchema = Schema.Struct({
  copyStatus: Schema.Literals(["none", "pending", "ready", "failed"]),
  id: Schema.String,
  name: Schema.String,
  projectId: Schema.String,
  projectName: Schema.String,
  sizeLabel: Schema.String,
  uploadedBy: Schema.String,
});

export const MemberSchema = Schema.Struct({
  employeeNumber: Schema.String,
  id: Schema.String,
  name: Schema.String,
  role: Schema.Literals(["admin", "employee"]),
  teamName: Schema.NullOr(Schema.String),
  title: Schema.NullOr(Schema.String),
});

export const TeamSchema = Schema.Struct({
  id: Schema.String,
  memberCount: Schema.Number,
  name: Schema.String,
});

export const ClientCompanySchema = Schema.Struct({
  active: Schema.Boolean,
  contactEmail: Schema.NullOr(Schema.String),
  id: Schema.String,
  name: Schema.String,
});

export const ActivityItemSchema = Schema.Struct({
  actorName: Schema.String,
  at: Schema.String,
  detail: Schema.String,
  id: Schema.String,
  kind: Schema.Literals([
    "archived",
    "comment",
    "created",
    "completed",
    "moved",
    "updated",
  ]),
  taskTitle: Schema.NullOr(Schema.String),
});

export const FavoriteItemSchema = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(["project", "task"]),
  subtitle: Schema.String,
  title: Schema.String,
});

export const ArchivedItemSchema = Schema.Struct({
  archivedAt: Schema.String,
  id: Schema.String,
  kind: Schema.Literals(["project", "task"]),
  title: Schema.String,
});

export const SearchHitSchema = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(["project", "task"]),
  subtitle: Schema.String,
  title: Schema.String,
});

export const BudgetSummarySchema = Schema.Struct({
  billedHours: Schema.Number,
  id: Schema.String,
  plannedHours: Schema.Number,
  projectName: Schema.String,
});

const list = <N extends string>(operationId: N, path: string, summary: string, data: Schema.Codec<any, any, any, any>) => ({
  data,
  method: "get" as const,
  operationId,
  path,
  summary,
});

export const workspaceRoutes = [
  list("listBugs", "/api/v1/workspace/bugs", "Lists the workspace bugs.", Schema.Struct({ bugs: Schema.Array(BugSummarySchema) })),
] as const satisfies readonly MobileRouteDefinition[];
