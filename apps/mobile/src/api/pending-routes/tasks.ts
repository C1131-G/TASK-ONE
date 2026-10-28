import { Schema } from "effect";

import type { MobileRouteDefinition } from "./route-definition";

export const TaskStatusSchema = Schema.Literals([
  "backlog",
  "todo",
  "progress",
  "review",
  "done",
]);

export const TaskPrioritySchema = Schema.Literals(["low", "medium", "high", "urgent"]);

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

export const SubtaskSchema = Schema.Struct({
  done: Schema.Boolean,
  id: Schema.String,
  title: Schema.String,
});

export const TaskDetailSchema = Schema.Struct({
  assigneeNames: Schema.Array(Schema.String),
  commentsCount: Schema.Number,
  description: Schema.NullOr(Schema.String),
  dueAt: Schema.NullOr(Schema.String),
  id: Schema.String,
  labels: Schema.Array(Schema.String),
  priority: TaskPrioritySchema,
  projectId: Schema.String,
  projectName: Schema.String,
  status: TaskStatusSchema,
  subtasks: Schema.Array(SubtaskSchema),
  title: Schema.String,
  version: Schema.Number,
});

export const TasksPageSchema = Schema.Struct({
  tasks: Schema.Array(TaskSummarySchema),
});

export const TaskVersionSchema = Schema.Struct({
  status: TaskStatusSchema,
  version: Schema.Number,
});

export const CreatedTaskSchema = Schema.Struct({
  id: Schema.String,
  number: Schema.Number,
  version: Schema.Number,
});

export const SubtasksPageSchema = Schema.Struct({
  subtasks: Schema.Array(SubtaskSchema),
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
    data: TaskDetailSchema,
    method: "get",
    operationId: "getTask",
    params: Schema.Struct({ taskId: Schema.String }),
    path: "/api/v1/workspace/tasks/{taskId}",
    summary: "Reads one task with its subtasks and labels.",
  },
  {
    body: Schema.Struct({
      expectedVersion: Schema.Number,
      status: TaskStatusSchema,
    }),
    data: TaskVersionSchema,
    method: "post",
    operationId: "setTaskStatus",
    params: Schema.Struct({ taskId: Schema.String }),
    path: "/api/v1/workspace/tasks/{taskId}/status",
    summary: "Moves a task's status with an optimistic version.",
  },
  {
    data: SubtasksPageSchema,
    method: "get",
    operationId: "listSubtasks",
    params: Schema.Struct({ taskId: Schema.String }),
    path: "/api/v1/workspace/tasks/{taskId}/subtasks",
    summary: "Lists a task's subtasks in order.",
  },
] as const satisfies readonly MobileRouteDefinition[];
