import { Schema } from "effect";

import type { MobileRouteDefinition } from "./route-definition";

// Pending until the server grows an all-tasks list and a subtask toggle. The
// literals match the live task routes; a test pins them against each other.

export const TaskStatusSchema = Schema.Literals(["backlog", "todo", "progress", "review", "done"]);
export const TaskPrioritySchema = Schema.Literals(["urgent", "high", "medium", "low", "none"]);

export const TaskSummarySchema = Schema.Struct({
  assigneeNames: Schema.Array(Schema.String),
  dueAt: Schema.NullOr(Schema.String),
  id: Schema.String,
  priority: TaskPrioritySchema,
  projectId: Schema.String,
  projectName: Schema.String,
  status: TaskStatusSchema,
  title: Schema.String,
  version: Schema.Number,
});

export const TasksPageSchema = Schema.Struct({
  tasks: Schema.Array(TaskSummarySchema),
});

export const taskRoutes = [
  {
    data: TasksPageSchema,
    method: "get",
    operationId: "listTasks",
    path: "/api/v1/workspace/tasks",
    query: Schema.Struct({
      projectId: Schema.optional(Schema.String),
      search: Schema.optional(Schema.String),
      status: Schema.optional(TaskStatusSchema),
    }),
    summary: "Lists the workspace tasks with optional filters.",
  },
  {
    body: Schema.Struct({
      done: Schema.Boolean,
      expectedVersion: Schema.Number,
    }),
    data: Schema.Struct({
      done: Schema.Boolean,
      version: Schema.Number,
    }),
    method: "post",
    operationId: "setSubtaskStatus",
    params: Schema.Struct({ id: Schema.String, subtaskId: Schema.String }),
    path: "/api/v1/workspace/tasks/{id}/subtasks/{subtaskId}/status",
    summary: "Toggles one subtask with an optimistic version.",
  },
] as const satisfies readonly MobileRouteDefinition[];
