import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";
import { CalendarDateSchema } from "../core/input-schemas";
import type { CreatedTask } from "../work/work-contracts";

export const SubtaskFieldsSchema = Schema.Struct({
  assigneeId: Schema.NullOr(Schema.String.check(Schema.isUUID())),
  description: Schema.NullOr(Schema.String.check(Schema.isMaxLength(10_000))),
  dueDate: Schema.NullOr(CalendarDateSchema),
  title: Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(240)),
});

export type SubtaskFields = typeof SubtaskFieldsSchema.Type;

export interface SubtaskEntry extends SubtaskFields {
  readonly id: string;
  readonly taskId: string;
  readonly position: number;
  readonly completed: boolean;
}

export interface CreatedSubtask {
  readonly subtask: SubtaskEntry;
  readonly parentVersion: number;
}

export const SubtaskEntrySchema = Schema.Struct({
  ...SubtaskFieldsSchema.fields,
  completed: Schema.Boolean,
  id: Schema.String,
  position: Schema.Number,
  taskId: Schema.String,
});

export const CreatedSubtaskSchema = Schema.Struct({
  parentVersion: Schema.Number,
  subtask: SubtaskEntrySchema,
});

export const RemovedSubtaskSchema = Schema.Struct({
  parentVersion: Schema.Number,
});

export const ReorderedSubtasksSchema = Schema.Struct({
  parentVersion: Schema.Number,
  subtasks: Schema.Array(SubtaskEntrySchema),
});

export interface UpdatedSubtask {
  readonly subtask: SubtaskEntry;
  readonly parentVersion: number;
}

export const UpdateSubtaskInputSchema = Schema.Struct({
  ...SubtaskFieldsSchema.fields,
  completed: Schema.Boolean,
});

export type UpdateSubtaskInput = typeof UpdateSubtaskInputSchema.Type;

export class SubtaskManagement extends Context.Service<
  SubtaskManagement,
  {
    readonly createSubtask: (
      actorId: string,
      taskId: string,
      expectedTaskVersion: number,
      input: SubtaskFields
    ) => Effect.Effect<CreatedSubtask, AppError>;
    readonly listSubtasks: (
      actorId: string,
      taskId: string
    ) => Effect.Effect<readonly SubtaskEntry[], AppError>;
    readonly reorderSubtasks: (
      actorId: string,
      taskId: string,
      expectedTaskVersion: number,
      subtaskIds: readonly string[]
    ) => Effect.Effect<typeof ReorderedSubtasksSchema.Type, AppError>;
    readonly updateSubtask: (
      actorId: string,
      subtaskId: string,
      expectedTaskVersion: number,
      input: UpdateSubtaskInput
    ) => Effect.Effect<UpdatedSubtask, AppError>;
    readonly removeSubtask: (
      actorId: string,
      subtaskId: string,
      expectedTaskVersion: number
    ) => Effect.Effect<{ readonly parentVersion: number }, AppError>;
    readonly promoteSubtask: (
      actorId: string,
      subtaskId: string,
      expectedTaskVersion: number
    ) => Effect.Effect<CreatedTask, AppError>;
  }
>()("metsys/server/SubtaskManagement") {}
