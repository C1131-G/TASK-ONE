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
import {
  ServerActionOutputSchema,
  runServerAction,
} from "@/src/server/core/server-action";
import {
  CreatedTaskSchema,
  ProjectTaskListItemSchema,
  WorkManagement,
  WorkManagementLive,
} from "@/src/server/work/work-management";

import {
  TaskPriorityInputSchema,
  TaskStatusInputSchema,
  CreateTaskActionInputSchema,
  ListProjectTasksInputSchema,
  requestHeadersOrFail,
} from "./tasks-shared";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listProjectTasksAction(input: unknown) {
  return await runServerAction(
    input,
    ListProjectTasksInputSchema,
    (validated) =>
      Effect.gen(function* listProjectTasks() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const work = yield* WorkManagement;
        return yield* work.listProjectTasks(actor.id, validated.projectId, {
          includeArchived: validated.includeArchived ?? false,
          limit: validated.limit,
          offset: validated.offset,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(WorkManagementLive)
      ),
    undefined,
    Schema.Array(ProjectTaskListItemSchema)
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.

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
