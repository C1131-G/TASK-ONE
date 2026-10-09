"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import {
  CalendarDateSchema,
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { runServerAction } from "@/src/server/core/server-action";
import {
  CreatedSubtaskSchema,
  RemovedSubtaskSchema,
  SubtaskManagement,
  SubtaskManagementLive,
} from "@/src/server/tasks/subtask-management";
import { CreatedTaskSchema } from "@/src/server/work/work-management";

const runSubtaskAction = <
  InputSchema extends Schema.Codec<unknown, unknown, never, never>,
  Result,
>(
  input: unknown,
  schema: InputSchema,
  execute: (
    userId: string,
    validated: InputSchema["Type"]
  ) => Effect.Effect<Result, AppError, SubtaskManagement | Idempotency>
) =>
  runServerAction(input, schema, (validated) =>
    Effect.gen(function* authorizeSubtaskAction() {
      const requestHeaders = yield* Effect.tryPromise({
        catch: () =>
          new AppError({
            code: "UNAVAILABLE",
            message: "The request could not be completed.",
          }),
        try: () => headers(),
      });
      const sessions = yield* AuthSession;
      const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
      return yield* execute(user.id, validated).pipe(
        Effect.provide(SubtaskManagementLive),
        Effect.provide(IdempotencyLive)
      );
    }).pipe(Effect.provide(AuthSessionLive))
  );

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function createSubtaskAction(input: unknown) {
  const result = await runSubtaskAction(
    input,
    Schema.Struct({
      assigneeId: Schema.NullOr(UUIDSchema),
      description: Schema.NullOr(Schema.String),
      dueDate: Schema.NullOr(CalendarDateSchema),
      expectedTaskVersion: Schema.Number,
      idempotencyKey: IdempotencyKeySchema,
      taskId: UUIDSchema,
      title: Schema.String,
    }),
    (userId, validated) =>
      Effect.gen(function* createSubtask() {
        const subtasks = yield* SubtaskManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...subtaskInput } = validated;
        return yield* idempotency.run({
          actorId: userId,
          execute: () =>
            subtasks.createSubtask(
              userId,
              subtaskInput.taskId,
              subtaskInput.expectedTaskVersion,
              {
                assigneeId: subtaskInput.assigneeId,
                description: subtaskInput.description,
                dueDate: subtaskInput.dueDate,
                title: subtaskInput.title,
              }
            ),
          input: subtaskInput,
          key: idempotencyKey,
          operation: "subtask.create",
          resultSchema: CreatedSubtaskSchema,
        });
      })
  );
  if (result.ok) {
    revalidatePath(`/tasks/${result.data.subtask.taskId}`);
    revalidatePath("/tasks");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function updateSubtaskAction(input: unknown) {
  const result = await runSubtaskAction(
    input,
    Schema.Struct({
      assigneeId: Schema.NullOr(UUIDSchema),
      completed: Schema.Boolean,
      description: Schema.NullOr(Schema.String),
      dueDate: Schema.NullOr(CalendarDateSchema),
      expectedTaskVersion: Schema.Number,
      idempotencyKey: IdempotencyKeySchema,
      subtaskId: UUIDSchema,
      title: Schema.String,
    }),
    (userId, validated) =>
      Effect.gen(function* updateSubtask() {
        const subtasks = yield* SubtaskManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...subtaskInput } = validated;
        return yield* idempotency.run({
          actorId: userId,
          execute: () =>
            subtasks.updateSubtask(
              userId,
              subtaskInput.subtaskId,
              subtaskInput.expectedTaskVersion,
              {
                assigneeId: subtaskInput.assigneeId,
                completed: subtaskInput.completed,
                description: subtaskInput.description,
                dueDate: subtaskInput.dueDate,
                title: subtaskInput.title,
              }
            ),
          input: subtaskInput,
          key: idempotencyKey,
          operation: "subtask.update",
          resultSchema: CreatedSubtaskSchema,
        });
      })
  );
  if (result.ok) {
    revalidatePath(`/tasks/${result.data.subtask.taskId}`);
    revalidatePath("/tasks");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function removeSubtaskAction(input: unknown) {
  const result = await runSubtaskAction(
    input,
    Schema.Struct({
      expectedTaskVersion: Schema.Number,
      idempotencyKey: IdempotencyKeySchema,
      subtaskId: UUIDSchema,
    }),
    (userId, validated) =>
      Effect.gen(function* removeSubtask() {
        const subtasks = yield* SubtaskManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...removeInput } = validated;
        return yield* idempotency.run({
          actorId: userId,
          execute: () =>
            subtasks.removeSubtask(
              userId,
              removeInput.subtaskId,
              removeInput.expectedTaskVersion
            ),
          input: removeInput,
          key: idempotencyKey,
          operation: "subtask.remove",
          resultSchema: RemovedSubtaskSchema,
        });
      })
  );
  if (result.ok) {
    revalidatePath("/tasks");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function promoteSubtaskAction(input: unknown) {
  const result = await runSubtaskAction(
    input,
    Schema.Struct({
      expectedTaskVersion: Schema.Number,
      idempotencyKey: IdempotencyKeySchema,
      subtaskId: UUIDSchema,
    }),
    (userId, validated) =>
      Effect.gen(function* promoteSubtask() {
        const subtasks = yield* SubtaskManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...promoteInput } = validated;
        return yield* idempotency.run({
          actorId: userId,
          execute: () =>
            subtasks.promoteSubtask(
              userId,
              promoteInput.subtaskId,
              promoteInput.expectedTaskVersion
            ),
          input: promoteInput,
          key: idempotencyKey,
          operation: "subtask.promote",
          resultSchema: CreatedTaskSchema,
        });
      })
  );
  if (result.ok) {
    revalidatePath(`/projects/${result.data.projectId}`);
    revalidatePath("/tasks");
  }
  return result;
}
