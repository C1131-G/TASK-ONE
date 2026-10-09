"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
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
  TaskRecurrenceInputSchema,
  TaskVersionResultSchema,
  WorkManagement,
  WorkManagementLive,
} from "@/src/server/work/work-management";

import { requestHeadersOrFail } from "./tasks-shared";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function setTaskRecurrenceAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      expectedVersion: Schema.Number.check(
        Schema.isInt(),
        Schema.isGreaterThan(0)
      ),
      idempotencyKey: IdempotencyKeySchema,
      recurrence: Schema.NullOr(TaskRecurrenceInputSchema),
      taskId: UUIDSchema,
    }),
    (validated) =>
      Effect.gen(function* setTaskRecurrence() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const work = yield* WorkManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () =>
            work.setTaskRecurrence(
              actor.id,
              validated.taskId,
              validated.expectedVersion,
              validated.recurrence
            ),
          input: {
            expectedVersion: validated.expectedVersion,
            recurrence: validated.recurrence,
            taskId: validated.taskId,
          },
          key: validated.idempotencyKey,
          operation: "task.setRecurrence",
          resultSchema: TaskVersionResultSchema,
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
export async function moveTaskAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      destinationProjectId: UUIDSchema,
      expectedVersion: Schema.Number,
      idempotencyKey: IdempotencyKeySchema,
      taskId: UUIDSchema,
    }),
    (validated) =>
      Effect.gen(function* moveTask() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const work = yield* WorkManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () =>
            work.moveTask(
              actor.id,
              validated.taskId,
              validated.destinationProjectId,
              validated.expectedVersion
            ),
          input: {
            destinationProjectId: validated.destinationProjectId,
            expectedVersion: validated.expectedVersion,
            taskId: validated.taskId,
          },
          key: validated.idempotencyKey,
          operation: "task.move",
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
    revalidatePath(`/projects/${result.data.projectId}`);
    revalidatePath("/tasks");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function duplicateTaskAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      expectedVersion: Schema.Number,
      idempotencyKey: IdempotencyKeySchema,
      taskId: UUIDSchema,
    }),
    (validated) =>
      Effect.gen(function* duplicateTask() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const work = yield* WorkManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () =>
            work.duplicateTask(
              actor.id,
              validated.taskId,
              validated.expectedVersion
            ),
          input: {
            expectedVersion: validated.expectedVersion,
            taskId: validated.taskId,
          },
          key: validated.idempotencyKey,
          operation: "task.duplicate",
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
    revalidatePath(`/projects/${result.data.projectId}`);
    revalidatePath("/tasks");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
