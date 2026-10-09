"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { requireAdmin } from "@/src/server/core/admin-action";
import {
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import {
  ServerActionOutputSchema,
  runServerAction,
} from "@/src/server/core/server-action";
import {
  CreatedTaskSchema,
  TaskArchiveUndoReceiptSchema,
  WorkManagement,
  WorkManagementLive,
} from "@/src/server/work/work-management";

import { requestHeadersOrFail } from "./tasks-shared";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function archiveTaskAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      expectedVersion: Schema.Number,
      idempotencyKey: IdempotencyKeySchema,
      taskId: UUIDSchema,
    }),
    (validated) =>
      Effect.gen(function* archiveTask() {
        const requestHeaders = yield* requestHeadersOrFail;
        const administrator = yield* requireAdmin(requestHeaders);
        const work = yield* WorkManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            work.archiveTask(
              administrator.id,
              validated.taskId,
              validated.expectedVersion
            ),
          input: {
            expectedVersion: validated.expectedVersion,
            taskId: validated.taskId,
          },
          key: validated.idempotencyKey,
          operation: "task.archive",
          resultSchema: TaskArchiveUndoReceiptSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(WorkManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ServerActionOutputSchema
  );
  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/projects");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function restoreTaskAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      expectedVersion: Schema.Number,
      idempotencyKey: IdempotencyKeySchema,
      taskId: UUIDSchema,
    }),
    (validated) =>
      Effect.gen(function* restoreTask() {
        const requestHeaders = yield* requestHeadersOrFail;
        const administrator = yield* requireAdmin(requestHeaders);
        const work = yield* WorkManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            work.restoreTask(
              administrator.id,
              validated.taskId,
              validated.expectedVersion
            ),
          input: {
            expectedVersion: validated.expectedVersion,
            taskId: validated.taskId,
          },
          key: validated.idempotencyKey,
          operation: "task.restore",
          resultSchema: CreatedTaskSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(WorkManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ServerActionOutputSchema
  );
  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath(`/projects/${result.data.projectId}`);
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function undoTaskArchiveAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      undoId: UUIDSchema,
    }),
    (validated) =>
      Effect.gen(function* undoTaskArchive() {
        const requestHeaders = yield* requestHeadersOrFail;
        const administrator = yield* requireAdmin(requestHeaders);
        const work = yield* WorkManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            work
              .undoTaskArchive(administrator.id, validated.undoId)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: { undoId: validated.undoId },
          key: validated.idempotencyKey,
          operation: "task.undoArchive",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(WorkManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ServerActionOutputSchema
  );
  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/projects");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function undoTaskCompletionAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      undoId: UUIDSchema,
    }),
    (validated) =>
      Effect.gen(function* undoTaskCompletion() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const work = yield* WorkManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () =>
            work
              .undoTaskCompletion(actor.id, validated.undoId)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: { undoId: validated.undoId },
          key: validated.idempotencyKey,
          operation: "task.undoCompletion",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(WorkManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ServerActionOutputSchema
  );
  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/projects");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
