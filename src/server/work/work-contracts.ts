import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";
import { CalendarDateSchema } from "../core/input-schemas";

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

export const decodeTaskStatus = (status: string): UpdateTaskInput["status"] =>
  Schema.decodeUnknownSync(TaskStatusSchema)(status);
export const decodeTaskPriority = (
  priority: string
): CreateTaskInput["priority"] =>
  Schema.decodeUnknownSync(TaskPrioritySchema)(priority);

export const UpdateTaskInputSchema = Schema.Struct({
  assigneeIds: Schema.Array(Schema.String.check(Schema.isUUID())),
  description: Schema.NullOr(Schema.String),
  dueDate: Schema.NullOr(CalendarDateSchema),
  estimate: Schema.optional(
    Schema.NullOr(Schema.String.check(Schema.isMaxLength(40)))
  ),
  priority: TaskPrioritySchema,
  startDate: Schema.optional(Schema.NullOr(CalendarDateSchema)),
  status: TaskStatusSchema,
  title: Schema.String,
});

export type UpdateTaskInput = typeof UpdateTaskInputSchema.Type;

export const CreateTaskInputSchema = Schema.Struct({
  assigneeIds: Schema.Array(Schema.String.check(Schema.isUUID())),
  description: Schema.NullOr(Schema.String),
  dueDate: Schema.NullOr(CalendarDateSchema),
  estimate: Schema.optional(
    Schema.NullOr(Schema.String.check(Schema.isMaxLength(40)))
  ),
  priority: TaskPrioritySchema,
  projectId: Schema.String.check(Schema.isUUID()),
  startDate: Schema.optional(Schema.NullOr(CalendarDateSchema)),
  title: Schema.String,
});

export type CreateTaskInput = typeof CreateTaskInputSchema.Type;

export const TaskRecurrenceInputSchema = Schema.Struct({
  endsOn: Schema.NullOr(CalendarDateSchema),
  frequency: Schema.Literals(["daily", "weekly", "biweekly", "monthly"]),
  interval: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(1),
    Schema.isLessThanOrEqualTo(365)
  ),
  weekDays: Schema.Array(
    Schema.Number.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(0),
      Schema.isLessThanOrEqualTo(6)
    )
  ).check(Schema.isMaxLength(7)),
});

export type TaskRecurrenceInput = typeof TaskRecurrenceInputSchema.Type;

export const TaskCompletionSnapshotSchema = Schema.Struct({
  status: Schema.Literals(["backlog", "todo", "progress", "review"]),
  version: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(1)),
});

export interface CreatedTask {
  readonly id: string;
  readonly projectId: string;
  readonly projectTaskNumber: number;
  readonly title: string;
  readonly description: string | null;
  readonly status: UpdateTaskInput["status"];
  readonly priority: CreateTaskInput["priority"];
  readonly version: number;
  readonly createdById: string;
  readonly assigneeIds: readonly string[];
  readonly dueDate: string | null;
  readonly completionUndo?: TaskArchiveUndoReceipt;
  readonly recurrenceSuccessorId?: string;
}

export const CreatedTaskSchema = Schema.Struct({
  assigneeIds: Schema.Array(Schema.String.check(Schema.isUUID())),
  completionUndo: Schema.optional(
    Schema.Struct({
      expiresAt: Schema.String,
      undoId: Schema.String.check(Schema.isUUID()),
    })
  ),
  createdById: Schema.String.check(Schema.isUUID()),
  description: Schema.NullOr(Schema.String),
  dueDate: Schema.NullOr(Schema.String),
  id: Schema.String.check(Schema.isUUID()),
  priority: Schema.Literals(["urgent", "high", "medium", "low", "none"]),
  projectId: Schema.String.check(Schema.isUUID()),
  projectTaskNumber: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThan(0)
  ),
  recurrenceSuccessorId: Schema.optional(Schema.String.check(Schema.isUUID())),
  status: Schema.Literals(["backlog", "todo", "progress", "review", "done"]),
  title: Schema.String,
  version: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
});

export const TaskArchiveUndoReceiptSchema = Schema.Struct({
  expiresAt: Schema.String,
  undoId: Schema.String,
});

export const TaskVersionResultSchema = Schema.Struct({
  version: Schema.Number,
});

export interface TaskArchiveUndoReceipt {
  readonly undoId: string;
  readonly expiresAt: string;
}

export interface BulkTaskTarget {
  readonly taskId: string;
  readonly expectedVersion: number;
}

export interface BulkTaskChanges {
  readonly assigneeIds: readonly string[];
  readonly dueDate: string | null;
  readonly priority: UpdateTaskInput["priority"];
  readonly status: UpdateTaskInput["status"];
}

export interface ProjectTaskListItem extends CreatedTask {
  readonly archivedAt: string | null;
  readonly completedAt: string | null;
  readonly estimate: string | null;
  readonly position: number;
  readonly startDate: string | null;
  readonly assignees: readonly { readonly id: string; readonly name: string }[];
  readonly labelIds: readonly string[];
  readonly dependencyIds: readonly string[];
  readonly subtaskCount: number;
  readonly completedSubtaskCount: number;
}

export const ProjectTaskListItemSchema = Schema.Struct({
  ...CreatedTaskSchema.fields,
  archivedAt: Schema.NullOr(Schema.String),
  assignees: Schema.Array(
    Schema.Struct({ id: Schema.String, name: Schema.String })
  ),
  completedAt: Schema.NullOr(Schema.String),
  completedSubtaskCount: Schema.Number,
  dependencyIds: Schema.Array(Schema.String),
  estimate: Schema.NullOr(Schema.String),
  labelIds: Schema.Array(Schema.String),
  position: Schema.Number,
  startDate: Schema.NullOr(Schema.String),
  subtaskCount: Schema.Number,
});

export class WorkManagement extends Context.Service<
  WorkManagement,
  {
    readonly listProjectTasks: (
      actorId: string,
      projectId: string,
      pagination: {
        readonly includeArchived?: boolean;
        readonly limit: number;
        readonly offset: number;
      }
    ) => Effect.Effect<readonly ProjectTaskListItem[], AppError>;
    readonly createTask: (
      actorId: string,
      input: CreateTaskInput
    ) => Effect.Effect<CreatedTask, AppError>;
    readonly updateTask: (
      actorId: string,
      taskId: string,
      expectedVersion: number,
      input: UpdateTaskInput
    ) => Effect.Effect<CreatedTask, AppError>;
    readonly changeTaskStatus: (
      actorId: string,
      taskId: string,
      expectedVersion: number,
      status: UpdateTaskInput["status"]
    ) => Effect.Effect<CreatedTask, AppError>;
    readonly setTaskRecurrence: (
      actorId: string,
      taskId: string,
      expectedVersion: number,
      input: TaskRecurrenceInput | null
    ) => Effect.Effect<{ readonly version: number }, AppError>;
    readonly moveTask: (
      actorId: string,
      taskId: string,
      destinationProjectId: string,
      expectedVersion: number
    ) => Effect.Effect<CreatedTask, AppError>;
    readonly duplicateTask: (
      actorId: string,
      taskId: string,
      expectedVersion: number
    ) => Effect.Effect<CreatedTask, AppError>;
    readonly archiveTask: (
      actorId: string,
      taskId: string,
      expectedVersion: number
    ) => Effect.Effect<TaskArchiveUndoReceipt, AppError>;
    readonly undoTaskArchive: (
      actorId: string,
      undoId: string
    ) => Effect.Effect<void, AppError>;
    readonly undoTaskCompletion: (
      actorId: string,
      undoId: string
    ) => Effect.Effect<void, AppError>;
    readonly restoreTask: (
      actorId: string,
      taskId: string,
      expectedVersion: number
    ) => Effect.Effect<CreatedTask, AppError>;
    readonly bulkUpdateTasks: (
      actorId: string,
      targets: readonly BulkTaskTarget[],
      changes: BulkTaskChanges
    ) => Effect.Effect<readonly CreatedTask[], AppError>;
  }
>()("metsys/server/WorkManagement") {}
