"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import {
  CalendarDateSchema,
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import {
  ServerActionOutputSchema,
  runServerAction,
} from "@/src/server/core/server-action";
import {
  CreatedTaskSchema,
  TaskVersionResultSchema,
  WorkManagement,
  WorkManagementLive,
} from "@/src/server/work/work-management";

import {
  TaskPriorityInputSchema,
  TaskStatusInputSchema,
  CreateTaskActionInputSchema,
} from "./task-action-schemas";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function createTaskAction(input: unknown) {
  const result = await runServerAction(
    input,
    CreateTaskActionInputSchema,
    (validated) =>
      Effect.gen(function* createTask() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const work = yield* WorkManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...taskInput } = validated;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () => work.createTask(actor.id, taskInput),
          input: taskInput,
          key: idempotencyKey,
          operation: "task.create",
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
export async function updateTaskAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      assigneeIds: Schema.Array(UUIDSchema),
      description: Schema.NullOr(Schema.String),
      dueDate: Schema.NullOr(CalendarDateSchema),
      estimate: Schema.optional(
        Schema.NullOr(Schema.String.check(Schema.isMaxLength(40)))
      ),
      expectedVersion: Schema.Number,
      idempotencyKey: IdempotencyKeySchema,
      priority: TaskPriorityInputSchema,
      startDate: Schema.optional(Schema.NullOr(CalendarDateSchema)),
      status: TaskStatusInputSchema,
      taskId: UUIDSchema,
      title: Schema.String,
    }),
    (validated) =>
      Effect.gen(function* updateTask() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const work = yield* WorkManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...taskInput } = validated;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () =>
            work.updateTask(
              actor.id,
              taskInput.taskId,
              taskInput.expectedVersion,
              taskInput
            ),
          input: taskInput,
          key: idempotencyKey,
          operation: "task.update",
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
export async function changeTaskColumnAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      expectedVersion: Schema.Number.check(
        Schema.isInt(),
        Schema.isGreaterThan(0)
      ),
      idempotencyKey: IdempotencyKeySchema,
      status: TaskStatusInputSchema,
      taskId: UUIDSchema,
    }),
    (validated) =>
      Effect.gen(function* changeTaskColumn() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const work = yield* WorkManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () =>
            work.changeTaskStatus(
              actor.id,
              validated.taskId,
              validated.expectedVersion,
              validated.status
            ),
          input: {
            expectedVersion: validated.expectedVersion,
            status: validated.status,
            taskId: validated.taskId,
          },
          key: validated.idempotencyKey,
          operation: "task.changeStatus",
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

// Moves a task's start and due dates only. Used by the calendar and timeline, so
// it needs no title, assignee or status, and it still checks version and access.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function rescheduleTaskAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      dueDate: Schema.NullOr(CalendarDateSchema),
      expectedVersion: Schema.Number,
      idempotencyKey: IdempotencyKeySchema,
      startDate: Schema.NullOr(CalendarDateSchema),
      taskId: UUIDSchema,
    }),
    (validated) =>
      Effect.gen(function* rescheduleTask() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const work = yield* WorkManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...dates } = validated;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () =>
            work.rescheduleTask(actor.id, dates.taskId, dates.expectedVersion, {
              dueDate: dates.dueDate,
              startDate: dates.startDate,
            }),
          input: dates,
          key: idempotencyKey,
          operation: "task.reschedule",
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
    revalidatePath("/timeline");
    revalidatePath("/my-tasks");
    revalidatePath("/tasks");
  }
  return result;
}
