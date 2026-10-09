"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import { requireAdmin } from "@/src/server/core/admin-action";
import {
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "@/src/server/core/idempotency";
import {
  CalendarDateSchema,
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { runServerAction } from "@/src/server/core/server-action";
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
  ProjectTaskListItemSchema,
  TaskArchiveUndoReceiptSchema,
  TaskRecurrenceInputSchema,
  TaskVersionResultSchema,
  WorkManagement,
  WorkManagementLive,
} from "@/src/server/work/work-management";

const TaskPriorityInputSchema = Schema.Literals([
  "urgent",
  "high",
  "medium",
  "low",
  "none",
]);
const TaskStatusInputSchema = Schema.Literals([
  "backlog",
  "todo",
  "progress",
  "review",
  "done",
]);

const CreateTaskActionInputSchema = Schema.Struct({
  assigneeIds: Schema.Array(UUIDSchema),
  description: Schema.NullOr(Schema.String),
  dueDate: Schema.NullOr(CalendarDateSchema),
  idempotencyKey: IdempotencyKeySchema,
  priority: TaskPriorityInputSchema,
  projectId: UUIDSchema,
  title: Schema.String,
});

const ListProjectTasksInputSchema = Schema.Struct({
  limit: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(1),
    Schema.isLessThanOrEqualTo(200)
  ),
  offset: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  projectId: UUIDSchema,
});

const requestHeadersOrFail = Effect.tryPromise({
  catch: () =>
    new AppError({
      code: "UNAVAILABLE",
      message: "The request could not be completed.",
    }),
  try: () => headers(),
});

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
        return yield* work.listProjectTasks(
          actor.id,
          validated.projectId,
          validated
        );
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(WorkManagementLive)
      ),
    undefined,
    Schema.Array(ProjectTaskListItemSchema)
  );
}

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
      )
  );

  if (result.ok) {
    revalidatePath(`/projects/${result.data.projectId}`);
    revalidatePath("/tasks");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function updateTaskAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      assigneeIds: Schema.Array(UUIDSchema),
      description: Schema.NullOr(Schema.String),
      dueDate: Schema.NullOr(CalendarDateSchema),
      expectedVersion: Schema.Number,
      idempotencyKey: IdempotencyKeySchema,
      priority: TaskPriorityInputSchema,
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
      )
  );
  if (result.ok) {
    revalidatePath(`/projects/${result.data.projectId}`);
    revalidatePath("/tasks");
  }
  return result;
}

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
      )
  );
  if (result.ok) {
    revalidatePath(`/projects/${result.data.projectId}`);
    revalidatePath("/tasks");
  }
  return result;
}

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
      )
  );
  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/projects");
  }
  return result;
}

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
      )
  );
  if (result.ok) {
    revalidatePath(`/projects/${result.data.projectId}`);
    revalidatePath("/tasks");
  }
  return result;
}

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
      )
  );
  if (result.ok) {
    revalidatePath(`/projects/${result.data.projectId}`);
    revalidatePath("/tasks");
  }
  return result;
}

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
      )
  );
  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/projects");
  }
  return result;
}

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
      )
  );
  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath(`/projects/${result.data.projectId}`);
  }
  return result;
}

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
      )
  );
  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/projects");
  }
  return result;
}

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
      )
  );
  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/projects");
  }
  return result;
}

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
      )
  );
  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/projects");
  }
  return result;
}

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
      )
  );
  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath(`/tasks/${result.data.taskId}`);
  }
  return result;
}

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
      )
  );
  if (result.ok) {
    revalidatePath("/tasks");
    revalidatePath("/projects");
  }
  return result;
}
