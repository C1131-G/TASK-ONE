import { randomUUID } from "node:crypto";

import type { ResultType } from "@prisma/orm-postgres/components/runtime";
import { Context, Effect, Layer, Schema } from "effect";
import sanitizeHtml from "sanitize-html";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { CalendarDateSchema } from "../core/input-schemas";
import { allocateTaskNumber } from "../work/work-management";
import type { CreatedTask } from "../work/work-management";

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

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type StoredSubtask = ResultType<typeof db.orm.public.TaskSubtask>;

const mapError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return new AppError({
      code: "CONFLICT",
      message: "The subtask was changed by another request.",
    });
  }
  return new AppError({
    code: "UNAVAILABLE",
    message: "The subtask request could not be completed.",
  });
};

const sanitizeDescription = (description: string | null): string | null =>
  description
    ? sanitizeHtml(description, {
        allowedAttributes: { a: ["href", "title"] },
        allowedSchemes: ["https", "http", "mailto"],
        allowedTags: [
          "a",
          "b",
          "br",
          "code",
          "em",
          "i",
          "li",
          "ol",
          "p",
          "pre",
          "s",
          "strong",
          "u",
          "ul",
        ],
      })
    : null;

const decodeSubtaskFields = (input: unknown): SubtaskFields => {
  try {
    const fields = Schema.decodeUnknownSync(SubtaskFieldsSchema)(input);
    return { ...fields, description: sanitizeDescription(fields.description) };
  } catch {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Enter valid subtask details.",
    });
  }
};

const decodeUpdateSubtaskInput = (input: unknown): UpdateSubtaskInput => {
  try {
    const fields = Schema.decodeUnknownSync(UpdateSubtaskInputSchema)(input);
    return { ...fields, description: sanitizeDescription(fields.description) };
  } catch {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Enter valid subtask details.",
    });
  }
};

const requireEditableTask = async (
  transaction: Transaction,
  actorId: string,
  taskId: string,
  expectedVersion: number
) => {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "A valid task version is required.",
    });
  }
  const actor = await transaction.orm.public.User.where({ id: actorId })
    .select("role", "mustChangePassword", "deactivatedAt")
    .first();
  if (!actor || actor.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (actor.mustChangePassword) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Change your password before continuing.",
    });
  }
  const task = await transaction.orm.public.Task.include("project")
    .where({ id: taskId })
    .first();
  if (!task) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The task was not found.",
    });
  }
  if (task.archivedAt || task.project.archivedAt) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Archived work is read only.",
    });
  }
  if (task.version !== expectedVersion) {
    throw new AppError({
      code: "CONFLICT",
      message: "The task changed. Refresh and try again.",
    });
  }
  if (actor.role !== "admin" && task.createdById !== actorId) {
    const assignment = await transaction.orm.public.TaskAssignee.where({
      taskId,
      userId: actorId,
    })
      .select("taskId")
      .first();
    if (!assignment) {
      throw new AppError({
        code: "FORBIDDEN",
        message: "You cannot edit this task.",
      });
    }
  }
  return task;
};

const validateAssignee = async (
  transaction: Transaction,
  assigneeId: string | null
): Promise<void> => {
  if (!assigneeId) {
    return;
  }
  const user = await transaction.orm.public.User.where({
    deactivatedAt: null,
    id: assigneeId,
  })
    .select("id")
    .first();
  if (!user) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Choose an active employee for the subtask.",
    });
  }
};

const toEntry = (row: StoredSubtask): SubtaskEntry => ({
  assigneeId: row.assigneeId,
  completed: row.completedAt !== null,
  description: row.description,
  dueDate: row.dueDate,
  id: row.id,
  position: row.position,
  taskId: row.taskId,
  title: row.title,
});

const writeActivity = async (
  transaction: Transaction,
  actorId: string,
  taskId: string,
  projectId: string,
  action: string,
  details: Record<string, string | number | boolean>
): Promise<void> => {
  await transaction.orm.public.Activity.create({
    action,
    actorId,
    createdAt: new Date(),
    details,
    id: randomUUID(),
    projectId,
    taskId,
  });
};

const nextPosition = (positions: readonly number[]): number => {
  let highestPosition = -1;
  for (const position of positions) {
    highestPosition = Math.max(highestPosition, position);
  }
  return highestPosition + 1;
};

const advanceParent = async (
  transaction: Transaction,
  taskId: string,
  expectedVersion: number
): Promise<number> => {
  const updated = await transaction.orm.public.Task.where({
    id: taskId,
    version: expectedVersion,
  }).updateAndCount({ updatedAt: new Date(), version: expectedVersion + 1 });
  if (!updated) {
    throw new AppError({
      code: "CONFLICT",
      message: "The task changed. Refresh and try again.",
    });
  }
  return expectedVersion + 1;
};

const createSubtask = (
  actorId: string,
  taskId: string,
  expectedTaskVersion: number,
  rawInput: SubtaskFields
): Effect.Effect<CreatedSubtask, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => {
      const input = decodeSubtaskFields(rawInput);
      return db.transaction(async (transaction) => {
        const task = await requireEditableTask(
          transaction,
          actorId,
          taskId,
          expectedTaskVersion
        );
        await validateAssignee(transaction, input.assigneeId);
        const existing = await transaction.orm.public.TaskSubtask.where({
          taskId,
        })
          .select("position")
          .all();
        const position = nextPosition(existing.map((row) => row.position));
        const id = randomUUID();
        const row = await transaction.orm.public.TaskSubtask.create({
          assigneeId: input.assigneeId,
          completedAt: null,
          createdAt: new Date(),
          description: input.description,
          dueDate: input.dueDate,
          id,
          isCompleted: false,
          position,
          taskId,
          title: input.title,
        });
        const parentVersion = await advanceParent(
          transaction,
          taskId,
          expectedTaskVersion
        );
        await writeActivity(
          transaction,
          actorId,
          taskId,
          task.projectId,
          "subtask.created",
          { subtaskId: id }
        );
        return { parentVersion, subtask: toEntry(row) };
      });
    },
  });

const listSubtasks = (
  actorId: string,
  taskId: string
): Effect.Effect<readonly SubtaskEntry[], AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      const actor = await db.orm.public.User.where({ id: actorId })
        .select("deactivatedAt", "mustChangePassword")
        .first();
      if (!actor || actor.deactivatedAt) {
        throw new AppError({
          code: "UNAUTHENTICATED",
          message: "Sign in to continue.",
        });
      }
      if (actor.mustChangePassword) {
        throw new AppError({
          code: "FORBIDDEN",
          message: "Change your password before continuing.",
        });
      }
      const task = await db.orm.public.Task.where({ id: taskId })
        .select("id")
        .first();
      if (!task) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "The task was not found.",
        });
      }
      const rows = await db.orm.public.TaskSubtask.where({ taskId })
        .orderBy((subtask) => subtask.position.asc())
        .all();
      return rows.map(toEntry);
    },
  });

const updateSubtask = (
  actorId: string,
  subtaskId: string,
  expectedTaskVersion: number,
  rawInput: UpdateSubtaskInput
): Effect.Effect<UpdatedSubtask, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => {
      const input = decodeUpdateSubtaskInput(rawInput);
      return db.transaction(async (transaction) => {
        const reference = await transaction.orm.public.TaskSubtask.where({
          id: subtaskId,
        }).first();
        if (!reference) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The subtask was not found.",
          });
        }
        const task = await requireEditableTask(
          transaction,
          actorId,
          reference.taskId,
          expectedTaskVersion
        );
        await validateAssignee(transaction, input.assigneeId);
        const now = new Date();
        const updated = await transaction.orm.public.TaskSubtask.where({
          id: subtaskId,
        }).update({
          assigneeId: input.assigneeId,
          completedAt: input.completed ? (reference.completedAt ?? now) : null,
          description: input.description,
          dueDate: input.dueDate,
          isCompleted: input.completed,
          title: input.title,
        });
        if (!updated) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The subtask was not found.",
          });
        }
        const parentVersion = await advanceParent(
          transaction,
          task.id,
          expectedTaskVersion
        );
        await writeActivity(
          transaction,
          actorId,
          task.id,
          task.projectId,
          "subtask.updated",
          { completed: input.completed, subtaskId }
        );
        return { parentVersion, subtask: toEntry(updated) };
      });
    },
  });

const removeSubtask = (
  actorId: string,
  subtaskId: string,
  expectedTaskVersion: number
): Effect.Effect<{ readonly parentVersion: number }, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () =>
      db.transaction(async (transaction) => {
        const reference = await transaction.orm.public.TaskSubtask.where({
          id: subtaskId,
        }).first();
        if (!reference) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The subtask was not found.",
          });
        }
        const task = await requireEditableTask(
          transaction,
          actorId,
          reference.taskId,
          expectedTaskVersion
        );
        await transaction.orm.public.TaskSubtask.where({
          id: subtaskId,
        }).delete();
        const parentVersion = await advanceParent(
          transaction,
          task.id,
          expectedTaskVersion
        );
        await writeActivity(
          transaction,
          actorId,
          task.id,
          task.projectId,
          "subtask.removed",
          { subtaskId }
        );
        return { parentVersion };
      }),
  });

const promoteSubtask = (
  actorId: string,
  subtaskId: string,
  expectedTaskVersion: number
): Effect.Effect<CreatedTask, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () =>
      db.transaction(async (transaction) => {
        const subtask = await transaction.orm.public.TaskSubtask.where({
          id: subtaskId,
        }).first();
        if (!subtask) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The subtask was not found.",
          });
        }
        const parent = await requireEditableTask(
          transaction,
          actorId,
          subtask.taskId,
          expectedTaskVersion
        );
        await validateAssignee(transaction, subtask.assigneeId);
        const [projectTaskNumber, tasks] = await Promise.all([
          allocateTaskNumber(transaction, parent.projectId),
          transaction.orm.public.Task.where({ projectId: parent.projectId })
            .select("position")
            .all(),
        ]);
        const position = nextPosition(tasks.map((row) => row.position));
        const id = randomUUID();
        const now = new Date();
        await transaction.orm.public.Task.create({
          archivedAt: null,
          archivedById: null,
          completedAt: null,
          createdAt: now,
          createdById: actorId,
          description: subtask.description,
          dueDate: subtask.dueDate,
          estimate: null,
          id,
          position,
          priority: "none",
          projectId: parent.projectId,
          projectTaskNumber,
          startDate: null,
          status: "todo",
          title: subtask.title,
          updatedAt: now,
          version: 1,
        });
        if (subtask.assigneeId) {
          await transaction.orm.public.TaskAssignee.create({
            assignedAt: now,
            assignedById: actorId,
            taskId: id,
            userId: subtask.assigneeId,
          });
        }
        await transaction.orm.public.TaskSubtask.where({
          id: subtaskId,
        }).delete();
        await advanceParent(transaction, parent.id, expectedTaskVersion);
        await writeActivity(
          transaction,
          actorId,
          id,
          parent.projectId,
          "subtask.promoted",
          { parentTaskId: parent.id, subtaskId }
        );
        return {
          assigneeIds: subtask.assigneeId ? [subtask.assigneeId] : [],
          createdById: actorId,
          description: subtask.description,
          dueDate: subtask.dueDate,
          id,
          priority: "none" as const,
          projectId: parent.projectId,
          projectTaskNumber,
          status: "todo" as const,
          title: subtask.title,
          version: 1,
        };
      }),
  });

export const SubtaskManagementLive = Layer.succeed(
  SubtaskManagement,
  SubtaskManagement.of({
    createSubtask,
    listSubtasks,
    promoteSubtask,
    removeSubtask,
    updateSubtask,
  })
);
