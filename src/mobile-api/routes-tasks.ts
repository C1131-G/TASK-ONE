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

export const TaskActionSchema = Schema.Literals([
  "update",
  "manageSubtasks",
  "comment",
  "trackTime",
]);

export const SubtaskSchema = Schema.Struct({
  assigneeId: Schema.NullOr(Schema.String),
  completed: Schema.Boolean,
  description: Schema.NullOr(Schema.String),
  dueDate: Schema.NullOr(Schema.String),
  id: Schema.String,
  position: Schema.Number,
  taskId: Schema.String,
  title: Schema.String,
});

export const DiscussionEntrySchema = Schema.Struct({
  authorId: Schema.String,
  authorName: Schema.String,
  body: Schema.String,
  createdAt: Schema.String,
  id: Schema.String,
  visibility: Schema.Literals(["public", "internal"]),
});

export const TaskContextSchema = Schema.Struct({
  assignees: Schema.Array(
    Schema.Struct({ id: Schema.String, name: Schema.String })
  ),
  createdById: Schema.String,
  description: Schema.NullOr(Schema.String),
  discussion: Schema.Array(DiscussionEntrySchema),
  dueDate: Schema.NullOr(Schema.String),
  id: Schema.String,
  isArchived: Schema.Boolean,
  permittedActions: Schema.Array(TaskActionSchema),
  priority: TaskPrioritySchema,
  projectId: Schema.String,
  projectName: Schema.String,
  reference: Schema.String,
  startDate: Schema.NullOr(Schema.String),
  status: TaskStatusSchema,
  subtasks: Schema.Array(SubtaskSchema),
  title: Schema.String,
  type: Schema.Literals(["task", "bug"]),
  version: Schema.Number,
});

export type MobileTaskContext = typeof TaskContextSchema.Type;

const TaskPathSchema = Schema.Struct({ taskId: IdSchema });

export const taskContextRoute = {
  data: TaskContextSchema,
  method: "get",
  operationId: "getTaskContext",
  params: TaskPathSchema,
  path: "/api/v1/workspace/tasks/{taskId}",
  summary:
    "One task with its assignees, subtasks, discussion, version and what the caller may do with it.",
} as const satisfies RouteDefinition;

const CalendarDayText = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u)
);

const ExpectedVersionSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(1)
);

// What a quick change or a create answers with: the task's new state and the
// version the next write must send.
export const TaskChangeSchema = Schema.Struct({
  assigneeIds: Schema.Array(Schema.String),
  dueDate: Schema.NullOr(Schema.String),
  id: Schema.String,
  priority: TaskPrioritySchema,
  projectId: Schema.String,
  reference: Schema.String,
  status: TaskStatusSchema,
  title: Schema.String,
  version: Schema.Number,
});

export type MobileTaskChange = typeof TaskChangeSchema.Type;

export const TaskChangeBodySchema = Schema.Struct({
  assigneeIds: Schema.optional(
    Schema.Array(IdSchema).check(Schema.isMaxLength(100))
  ),
  dueDate: Schema.optional(Schema.NullOr(CalendarDayText)),
  expectedVersion: ExpectedVersionSchema,
  priority: Schema.optional(TaskPrioritySchema),
  status: Schema.optional(TaskStatusSchema),
});

export type MobileTaskChangeBody = typeof TaskChangeBodySchema.Type;

export const taskChangeRoute = {
  body: TaskChangeBodySchema,
  data: TaskChangeSchema,
  method: "patch",
  operationId: "changeTask",
  params: TaskPathSchema,
  path: "/api/v1/workspace/tasks/{taskId}",
  summary:
    "Change a task's status, priority, due date or assignees. Needs the version the caller last saw; a stale one answers 409.",
} as const satisfies RouteDefinition;

export const taskRoutes = [
  myWorkRoute,
  taskContextRoute,
  taskChangeRoute,
] as const satisfies readonly RouteDefinition[];
