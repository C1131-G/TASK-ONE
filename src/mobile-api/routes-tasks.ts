import { Schema } from "effect";

import type { RouteDefinition } from "./route-definition";

// Task actions: context, quick updates, discussions, subtasks, own timer.
// Owned by one branch, so adding routes here never conflicts with the others.

const IdSchema = Schema.String.check(Schema.isUUID());

export const TaskStatusSchema = Schema.Literals([
  "backlog",
  "todo",
  "progress",
  "review",
  "done",
]);
export const TaskPrioritySchema = Schema.Literals([
  "urgent",
  "high",
  "medium",
  "low",
  "none",
]);

export const MY_WORK_MAX_PAGE_SIZE = 50;

const MyWorkItemSchema = Schema.Struct({
  dueDate: Schema.NullOr(Schema.String),
  id: Schema.String,
  isOverdue: Schema.Boolean,
  priority: TaskPrioritySchema,
  projectId: Schema.String,
  projectName: Schema.String,
  reference: Schema.String,
  status: TaskStatusSchema,
  title: Schema.String,
  version: Schema.Number,
});

export const MyWorkSchema = Schema.Struct({
  items: Schema.Array(MyWorkItemSchema),
  nextOffset: Schema.NullOr(Schema.Number),
});

export type MobileMyWork = typeof MyWorkSchema.Type;

export const myWorkRoute = {
  data: MyWorkSchema,
  method: "get",
  operationId: "getMyWork",
  path: "/api/v1/workspace/me/work",
  query: Schema.Struct({
    limit: Schema.optional(
      Schema.FiniteFromString.check(
        Schema.isInt(),
        Schema.isBetween({ maximum: MY_WORK_MAX_PAGE_SIZE, minimum: 1 })
      )
    ),
    offset: Schema.optional(
      Schema.FiniteFromString.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(0)
      )
    ),
    scope: Schema.optional(Schema.Literals(["assigned", "due", "overdue"])),
  }),
  summary:
    "Open tasks assigned to the caller: all of them, those due today or earlier, or only the overdue ones.",
} as const satisfies RouteDefinition;

export const taskRoutes = [
  myWorkRoute,
] as const satisfies readonly RouteDefinition[];

export { IdSchema };
