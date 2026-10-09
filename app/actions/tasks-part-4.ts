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
  TaskOrdering,
  TaskOrderingLive,
  OrderedTaskSchema,
} from "@/src/server/tasks/task-ordering";
import {
  TaskRelations,
  TaskRelationsLive,
  TaskRelationResultSchema,
} from "@/src/server/tasks/task-relations";
import {
  CreatedTaskSchema,
  WorkManagement,
  WorkManagementLive,
} from "@/src/server/work/work-management";

import {
  TaskPriorityInputSchema,
  TaskStatusInputSchema,
  requestHeadersOrFail,
} from "./tasks-shared";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function bulkUpdateTasksAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      changes: Schema.Struct({
        assigneeIds: Schema.Array(UUIDSchema),
        dueDate: Schema.NullOr(CalendarDateSchema),
        priority: TaskPriorityInputSchema,
        status: TaskStatusInputSchema,
      }),
      idempotencyKey: IdempotencyKeySchema,
      targets: Schema.Array(
        Schema.Struct({
          expectedVersion: Schema.Number,
          taskId: UUIDSchema,
        })
      ),
    }),
    (validated) =>
      Effect.gen(function* bulkUpdateTasks() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const work = yield* WorkManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () =>
            work.bulkUpdateTasks(
              actor.id,
              validated.targets,
              validated.changes
            ),
          input: { changes: validated.changes, targets: validated.targets },
          key: validated.idempotencyKey,
          operation: "task.bulkUpdate",
          resultSchema: Schema.Array(CreatedTaskSchema),
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
export async function setTaskRelationsAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      dependencyTaskIds: Schema.Array(UUIDSchema),
      expectedVersion: Schema.Number,
      idempotencyKey: IdempotencyKeySchema,
      labelIds: Schema.Array(UUIDSchema),
      taskId: UUIDSchema,
    }),
    (validated) =>
      Effect.gen(function* setTaskRelations() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const relations = yield* TaskRelations;
        const idempotency = yield* Idempotency;
        const relationInput = {
          dependencyTaskIds: validated.dependencyTaskIds,
          labelIds: validated.labelIds,
        };
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () =>
            relations.setTaskRelations(
              actor.id,
              validated.taskId,
              validated.expectedVersion,
              relationInput
            ),
          input: {
            ...relationInput,
            expectedVersion: validated.expectedVersion,
            taskId: validated.taskId,
          },
          key: validated.idempotencyKey,
          operation: "task.setRelations",
          resultSchema: TaskRelationResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(TaskRelationsLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ServerActionOutputSchema
  );
  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath(`/tasks/${result.data.taskId}`);
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function reorderTasksAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      changes: Schema.Array(
        Schema.Struct({
          expectedVersion: Schema.Number,
          position: Schema.Number,
          taskId: UUIDSchema,
        })
      ),
      idempotencyKey: IdempotencyKeySchema,
    }),
    (validated) =>
      Effect.gen(function* reorderTasks() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const ordering = yield* TaskOrdering;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () => ordering.reorderTasks(actor.id, validated.changes),
          input: { changes: validated.changes },
          key: validated.idempotencyKey,
          operation: "task.reorder",
          resultSchema: Schema.Array(OrderedTaskSchema),
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(TaskOrderingLive),
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
