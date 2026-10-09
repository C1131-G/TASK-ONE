import { randomUUID } from "node:crypto";

import type { ResultType } from "@prisma/orm-postgres/components/runtime";
import { and } from "@prisma/orm-postgres/orm-client";
import { Context, Effect, Layer, Schema } from "effect";
import sanitizeHtml from "sanitize-html";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { CalendarDateSchema } from "../core/input-schemas";

const TaskStatusSchema = Schema.Literals([
  "backlog",
  "todo",
  "progress",
  "review",
  "done",
]);
const TaskPrioritySchema = Schema.Literals([
  "urgent",
  "high",
  "medium",
  "low",
  "none",
]);

const decodeTaskStatus = (status: string): UpdateTaskInput["status"] =>
  Schema.decodeUnknownSync(TaskStatusSchema)(status);
const decodeTaskPriority = (priority: string): CreateTaskInput["priority"] =>
  Schema.decodeUnknownSync(TaskPrioritySchema)(priority);

export const UpdateTaskInputSchema = Schema.Struct({
  assigneeIds: Schema.Array(Schema.String.check(Schema.isUUID())),
  description: Schema.NullOr(Schema.String),
  dueDate: Schema.NullOr(CalendarDateSchema),
  priority: TaskPrioritySchema,
  status: TaskStatusSchema,
  title: Schema.String,
});

export type UpdateTaskInput = typeof UpdateTaskInputSchema.Type;

export const CreateTaskInputSchema = Schema.Struct({
  assigneeIds: Schema.Array(Schema.String.check(Schema.isUUID())),
  description: Schema.NullOr(Schema.String),
  dueDate: Schema.NullOr(CalendarDateSchema),
  priority: TaskPrioritySchema,
  projectId: Schema.String.check(Schema.isUUID()),
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

const TaskCompletionSnapshotSchema = Schema.Struct({
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

export class WorkManagement extends Context.Service<
  WorkManagement,
  {
    readonly listProjectTasks: (
      actorId: string,
      projectId: string,
      pagination: { readonly limit: number; readonly offset: number }
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

const databaseError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "23505" || error.code === "P2002")
  ) {
    return new AppError({
      code: "CONFLICT",
      message: "The requested task conflicts with existing work.",
    });
  }
  return new AppError({
    code: "UNAVAILABLE",
    message: "The task could not be created.",
  });
};

const validateInput = (input: CreateTaskInput): CreateTaskInput => {
  const title = input.title.trim();
  if (!input.projectId || !title || title.length > 240) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Enter a task title between 1 and 240 characters.",
    });
  }
  if (input.assigneeIds.length > 100) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "A task can have at most 100 assignees.",
    });
  }
  if (input.dueDate !== null && !Schema.is(CalendarDateSchema)(input.dueDate)) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Enter a valid due date.",
    });
  }
  const assigneeIds = [...new Set(input.assigneeIds)];
  return {
    ...input,
    assigneeIds,
    description: input.description
      ? sanitizeHtml(input.description, {
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
      : null,
    title,
  };
};

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const notifyTaskAssignees = async (
  transaction: Transaction,
  actor: { readonly id: string; readonly name: string },
  task: {
    readonly id: string;
    readonly projectId: string;
    readonly title: string;
  },
  assigneeIds: readonly string[],
  now: Date,
  eventType: "assignment" | "update" = "assignment"
): Promise<void> => {
  const recipients = [...new Set(assigneeIds)].filter(
    (userId) => userId !== actor.id
  );
  if (recipients.length === 0) {
    return;
  }
  const activeRecipients = await transaction.orm.public.User.where((user) =>
    and(user.id.in(recipients), user.deactivatedAt.isNull())
  )
    .select("id")
    .all();
  const activeRecipientIds = activeRecipients.map(({ id }) => id);
  if (activeRecipientIds.length === 0) {
    return;
  }
  const disabled = await transaction.orm.public.NotificationPreference.where(
    (preference) =>
      and(
        preference.userId.in(activeRecipientIds),
        preference.eventType.eq(eventType),
        preference.enabled.eq(false)
      )
  )
    .select("userId", "channel")
    .all();
  const disabledChannels = new Set(
    disabled.map(({ channel, userId }) => `${userId}:${channel}`)
  );
  const writes: Promise<unknown>[] = [];
  for (const userId of activeRecipientIds) {
    const notificationId = randomUUID();
    const text =
      eventType === "assignment"
        ? `${actor.name} assigned you a task`
        : `${actor.name} updated a task`;
    if (!disabledChannels.has(`${userId}:in-app`)) {
      writes.push(
        transaction.orm.public.Notification.create({
          actorId: actor.id,
          createdAt: now,
          id: notificationId,
          projectId: task.projectId,
          readAt: null,
          snippet: task.title,
          taskId: task.id,
          text,
          type: eventType,
          userId,
        })
      );
    }
    if (!disabledChannels.has(`${userId}:web-push`)) {
      writes.push(
        transaction.orm.public.Job.create({
          availableAt: now,
          createdAt: now,
          dedupeKey: `push:${notificationId}`,
          id: randomUUID(),
          kind: "notifications.deliver-push",
          payload: {
            actorId: actor.id,
            body: task.title,
            eventType,
            notificationId,
            title: text,
            url: `/tasks/${task.id}`,
            userId,
          },
          updatedAt: now,
        })
      );
    }
  }
  await Promise.all(writes);
};

export const allocateTaskNumber = async (
  transaction: Transaction,
  projectId: string
): Promise<number> => {
  const now = new Date();
  const counter = await transaction.orm.public.ProjectTaskCounter.upsert({
    conflictOn: { projectId },
    create: { nextNumber: 1, projectId, updatedAt: now },
    update: { updatedAt: now },
  });
  const allocated = await transaction.orm.public.ProjectTaskCounter.where({
    nextNumber: counter.nextNumber,
    projectId,
  }).updateAndCount({
    nextNumber: counter.nextNumber + 1,
    updatedAt: new Date(),
  });
  if (!allocated) {
    throw new AppError({
      code: "CONFLICT",
      message: "Task numbering changed. Retry the request.",
    });
  }
  return counter.nextNumber;
};

const createTaskInTransaction = async (
  transaction: Transaction,
  actorId: string,
  input: CreateTaskInput
): Promise<CreatedTask> => {
  const actor = await transaction.orm.public.User.where({ id: actorId })
    .select("deactivatedAt", "mustChangePassword", "name")
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
  const project = await transaction.orm.public.Project.where({
    archivedAt: null,
    id: input.projectId,
  })
    .select("id")
    .first();
  if (!project) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The active project was not found.",
    });
  }
  const assignees = await transaction.orm.public.User.where((user) =>
    user.id.in(input.assigneeIds)
  )
    .select("id", "deactivatedAt")
    .all();
  if (
    assignees.length !== input.assigneeIds.length ||
    assignees.some(({ deactivatedAt }) => deactivatedAt)
  ) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Choose active employee accounts for every assignee.",
    });
  }
  const projectTaskNumber = await allocateTaskNumber(
    transaction,
    input.projectId
  );
  const taskId = randomUUID();
  const now = new Date();
  await transaction.orm.public.Task.create({
    archivedAt: null,
    archivedById: null,
    completedAt: null,
    createdAt: now,
    createdById: actorId,
    description: input.description,
    dueDate: input.dueDate,
    estimate: null,
    id: taskId,
    position: 0,
    priority: input.priority,
    projectId: input.projectId,
    projectTaskNumber,
    startDate: null,
    status: "todo",
    title: input.title,
    updatedAt: now,
    version: 1,
  });
  await Promise.all(
    input.assigneeIds.map((userId) =>
      transaction.orm.public.TaskAssignee.create({
        assignedAt: now,
        assignedById: actorId,
        taskId,
        userId,
      })
    )
  );
  await notifyTaskAssignees(
    transaction,
    { id: actorId, name: actor.name },
    { id: taskId, projectId: input.projectId, title: input.title },
    input.assigneeIds,
    now
  );
  await transaction.orm.public.Activity.create({
    action: "task.created",
    actorId,
    createdAt: now,
    details: { projectId: input.projectId, projectTaskNumber, taskId },
    id: randomUUID(),
    projectId: input.projectId,
    taskId,
  });
  return {
    assigneeIds: input.assigneeIds,
    createdById: actorId,
    description: input.description,
    dueDate: input.dueDate,
    id: taskId,
    priority: input.priority,
    projectId: input.projectId,
    projectTaskNumber,
    status: "todo",
    title: input.title,
    version: 1,
  };
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const formatDate = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

const nextRecurrenceDate = (
  dueDate: string,
  recurrence: TaskRecurrenceInput
): string => {
  const [yearText, monthText, dayText] = dueDate.split("-");
  const current = new Date(
    Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText))
  );
  if (recurrence.frequency === "daily") {
    return formatDate(addDays(current, recurrence.interval));
  }
  if (
    recurrence.frequency === "weekly" ||
    recurrence.frequency === "biweekly"
  ) {
    const weeks =
      recurrence.interval * (recurrence.frequency === "biweekly" ? 2 : 1);
    let next = addDays(current, weeks * 7);
    if (recurrence.weekDays.length > 0) {
      const selectedWeekDays = new Set(recurrence.weekDays);
      for (let offset = 0; offset < 7; offset += 1) {
        const candidate = addDays(next, offset);
        if (selectedWeekDays.has(candidate.getUTCDay())) {
          next = candidate;
          break;
        }
      }
    }
    return formatDate(next);
  }
  const targetMonth = new Date(
    Date.UTC(
      current.getUTCFullYear(),
      current.getUTCMonth() + recurrence.interval,
      1
    )
  );
  const lastDay = new Date(
    Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)
  ).getUTCDate();
  targetMonth.setUTCDate(Math.min(current.getUTCDate(), lastDay));
  return formatDate(targetMonth);
};

const setTaskRecurrence = (
  actorId: string,
  taskId: string,
  expectedVersion: number,
  rawInput: TaskRecurrenceInput | null
): Effect.Effect<{ readonly version: number }, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => {
      let input: TaskRecurrenceInput | null;
      try {
        input = Schema.decodeUnknownSync(
          Schema.NullOr(TaskRecurrenceInputSchema)
        )(rawInput);
      } catch {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Enter valid task recurrence settings.",
        });
      }
      return db.transaction(async (transaction) => {
        const actor = await transaction.orm.public.User.where({ id: actorId })
          .select("name", "role", "mustChangePassword", "deactivatedAt")
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
        if (input && task.status === "done") {
          throw new AppError({
            code: "VALIDATION_FAILED",
            message: "Recurrence can only be configured on an active task.",
          });
        }
        if (input && !task.dueDate) {
          throw new AppError({
            code: "VALIDATION_FAILED",
            message: "A due date is required before recurrence can be enabled.",
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
        const version = expectedVersion + 1;
        const now = new Date();
        const updated = await transaction.orm.public.Task.where({
          id: taskId,
          version: expectedVersion,
        }).updateAndCount({ updatedAt: now, version });
        if (!updated) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        if (!input) {
          await transaction.orm.public.TaskRecurrence.where({
            taskId,
          }).delete();
        }
        if (input) {
          const recurrence = await transaction.orm.public.TaskRecurrence.where({
            taskId,
          }).first();
          const values = {
            endsOn: input.endsOn,
            frequency: input.frequency,
            interval: input.interval,
            nextRunAt: task.dueDate,
            updatedAt: now,
            weekDays: input.weekDays,
          };
          await (recurrence
            ? transaction.orm.public.TaskRecurrence.where({ taskId }).update(
                values
              )
            : transaction.orm.public.TaskRecurrence.create({
                id: randomUUID(),
                taskId,
                ...values,
              }));
        }
        await transaction.orm.public.Activity.create({
          action: input ? "task.recurrence_updated" : "task.recurrence_removed",
          actorId,
          createdAt: now,
          details: { taskId, version },
          id: randomUUID(),
          projectId: task.projectId,
          taskId,
        });
        return { version };
      });
    },
  });

const createTask = (
  actorId: string,
  rawInput: CreateTaskInput
): Effect.Effect<CreatedTask, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => {
      const input = validateInput(rawInput);
      return db.transaction((transaction) =>
        createTaskInTransaction(transaction, actorId, input)
      );
    },
  });

interface PreparedTaskUpdate {
  readonly title: string;
  readonly description: string | null;
  readonly assigneeIds: readonly string[];
}

const prepareTaskUpdate = (
  rawInput: UpdateTaskInput,
  expectedVersion: number
): PreparedTaskUpdate => {
  const title = rawInput.title.trim();
  const description = rawInput.description
    ? sanitizeHtml(rawInput.description, {
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
  const assigneeIds = [...new Set(rawInput.assigneeIds)];

  if (!title || title.length > 240 || assigneeIds.length > 100) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Check the task title and assignee count.",
    });
  }
  if (
    rawInput.dueDate !== null &&
    !Schema.is(CalendarDateSchema)(rawInput.dueDate)
  ) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Enter a valid due date.",
    });
  }
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "A valid task version is required.",
    });
  }

  return { assigneeIds, description, title };
};

interface WorkspaceActor {
  readonly deactivatedAt: Date | null;
  readonly mustChangePassword: boolean;
  readonly role: string;
}

const assertWorkspaceActor: (
  actor: WorkspaceActor | null
) => asserts actor is WorkspaceActor = (actor) => {
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
};

const assertTaskEditPermission = (
  actor: WorkspaceActor,
  actorId: string,
  createdById: string,
  assignments: readonly { readonly userId: string }[]
): void => {
  if (
    actor.role !== "admin" &&
    createdById !== actorId &&
    !assignments.some(({ userId }) => userId === actorId)
  ) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You cannot edit this task.",
    });
  }
};

const assertActiveTaskAssignees = (
  assigneeIds: readonly string[],
  activeAssignees: readonly { readonly deactivatedAt: Date | null }[]
): void => {
  if (
    activeAssignees.length !== assigneeIds.length ||
    activeAssignees.some(({ deactivatedAt }) => deactivatedAt)
  ) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Choose active employees for every assignee.",
    });
  }
};

const createRecurrenceSuccessor = async (
  transaction: Transaction,
  recurrence: ResultType<typeof db.orm.public.TaskRecurrence> | null,
  task: Pick<
    ResultType<typeof db.orm.public.Task>,
    "id" | "projectId" | "estimate"
  >,
  actorId: string,
  version: number,
  dueDate: string | null,
  description: string | null,
  priority: CreateTaskInput["priority"],
  title: string,
  assigneeIds: readonly string[],
  now: Date
): Promise<string | undefined> => {
  if (!recurrence || !dueDate) {
    return undefined;
  }
  const existingGeneration =
    await transaction.orm.public.RecurrenceGeneration.where({
      sourceTaskId: task.id,
    }).first();
  if (existingGeneration) {
    return undefined;
  }
  let recurrenceInput: TaskRecurrenceInput;
  try {
    recurrenceInput = Schema.decodeUnknownSync(TaskRecurrenceInputSchema)({
      endsOn: recurrence.endsOn,
      frequency: recurrence.frequency,
      interval: recurrence.interval,
      weekDays: recurrence.weekDays ?? [],
    });
  } catch {
    throw new AppError({
      code: "CONFLICT",
      message: "The saved recurrence settings are invalid.",
    });
  }
  const nextDueDate = nextRecurrenceDate(dueDate, recurrenceInput);
  if (recurrenceInput.endsOn && nextDueDate > recurrenceInput.endsOn) {
    return undefined;
  }
  const [projectTasks, projectTaskNumber, sourceSubtasks] = await Promise.all([
    transaction.orm.public.Task.where({ projectId: task.projectId })
      .select("position")
      .all(),
    allocateTaskNumber(transaction, task.projectId),
    transaction.orm.public.TaskSubtask.where({ taskId: task.id })
      .orderBy((subtask) => subtask.position.asc())
      .all(),
  ]);
  let position = -1;
  for (const projectTask of projectTasks) {
    position = Math.max(position, projectTask.position);
  }
  const successorId = randomUUID();
  const successor = await transaction.orm.public.Task.create({
    archivedAt: null,
    archivedById: null,
    completedAt: null,
    createdAt: now,
    createdById: actorId,
    description,
    dueDate: nextDueDate,
    estimate: task.estimate,
    id: successorId,
    position: position + 1,
    priority,
    projectId: task.projectId,
    projectTaskNumber,
    startDate: null,
    status: "todo",
    title,
    updatedAt: now,
    version: 1,
  });
  await Promise.all(
    assigneeIds.map((userId) =>
      transaction.orm.public.TaskAssignee.create({
        assignedAt: now,
        assignedById: actorId,
        taskId: successorId,
        userId,
      })
    )
  );
  await Promise.all(
    sourceSubtasks.map((subtask) =>
      transaction.orm.public.TaskSubtask.create({
        assigneeId: subtask.assigneeId,
        completedAt: null,
        createdAt: now,
        description: subtask.description,
        dueDate: subtask.dueDate,
        id: randomUUID(),
        isCompleted: false,
        position: subtask.position,
        taskId: successorId,
        title: subtask.title,
      })
    )
  );
  await transaction.orm.public.TaskRecurrence.create({
    createdAt: now,
    endsOn: recurrenceInput.endsOn,
    frequency: recurrenceInput.frequency,
    id: randomUUID(),
    interval: recurrenceInput.interval,
    nextRunAt: nextDueDate,
    taskId: successorId,
    updatedAt: now,
    weekDays: recurrenceInput.weekDays,
  });
  await transaction.orm.public.RecurrenceGeneration.create({
    createdAt: now,
    generationKey: `${task.id}:${version}`,
    id: randomUUID(),
    sourceTaskId: task.id,
    successorTaskId: successorId,
  });
  await transaction.orm.public.Activity.create({
    action: "task.recurrence_generated",
    actorId,
    createdAt: now,
    details: { sourceTaskId: task.id, successorTaskId: successorId },
    id: randomUUID(),
    projectId: task.projectId,
    taskId: successor.id,
  });
  return successorId;
};

const updateTask = (
  actorId: string,
  taskId: string,
  expectedVersion: number,
  rawInput: UpdateTaskInput
): Effect.Effect<CreatedTask, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => {
      const { assigneeIds, description, title } = prepareTaskUpdate(
        rawInput,
        expectedVersion
      );
      return db.transaction(async (transaction) => {
        const actor = await transaction.orm.public.User.where({ id: actorId })
          .select("name", "role", "mustChangePassword", "deactivatedAt")
          .first();
        assertWorkspaceActor(actor);
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
            message: "Archived tasks are read only.",
          });
        }
        if (task.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        const [assignments, activeAssignees, recurrence] = await Promise.all([
          transaction.orm.public.TaskAssignee.where({ taskId })
            .select("userId")
            .all(),
          transaction.orm.public.User.where((user) => user.id.in(assigneeIds))
            .select("id", "deactivatedAt")
            .all(),
          transaction.orm.public.TaskRecurrence.where({ taskId }).first(),
        ]);
        if (recurrence && !rawInput.dueDate) {
          throw new AppError({
            code: "VALIDATION_FAILED",
            message: "Remove recurrence before clearing the task due date.",
          });
        }
        assertTaskEditPermission(actor, actorId, task.createdById, assignments);
        assertActiveTaskAssignees(assigneeIds, activeAssignees);
        const now = new Date();
        const version = expectedVersion + 1;
        const updated = await transaction.orm.public.Task.where({
          id: taskId,
          version: expectedVersion,
        }).updateAndCount({
          completedAt:
            rawInput.status === "done" ? (task.completedAt ?? now) : null,
          description,
          dueDate: rawInput.dueDate,
          priority: rawInput.priority,
          status: rawInput.status,
          title,
          updatedAt: now,
          version,
        });
        if (!updated) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        if (recurrence && rawInput.dueDate !== task.dueDate) {
          await transaction.orm.public.TaskRecurrence.where({ taskId }).update({
            nextRunAt: rawInput.dueDate,
            updatedAt: now,
          });
        }
        await transaction.orm.public.TaskAssignee.where({ taskId }).deleteAll();
        await Promise.all(
          assigneeIds.map((userId) =>
            transaction.orm.public.TaskAssignee.create({
              assignedAt: now,
              assignedById: actorId,
              taskId,
              userId,
            })
          )
        );
        const previouslyAssigned = new Set(
          assignments.map(({ userId }) => userId)
        );
        await notifyTaskAssignees(
          transaction,
          { id: actorId, name: actor.name },
          { id: taskId, projectId: task.projectId, title },
          assigneeIds.filter((userId) => !previouslyAssigned.has(userId)),
          now
        );
        const existingStakeholders = [
          task.createdById,
          ...assigneeIds.filter((userId) => previouslyAssigned.has(userId)),
        ];
        await notifyTaskAssignees(
          transaction,
          { id: actorId, name: actor.name },
          { id: taskId, projectId: task.projectId, title },
          existingStakeholders,
          now,
          "update"
        );
        await transaction.orm.public.Activity.create({
          action: "task.updated",
          actorId,
          createdAt: now,
          details: { taskId, version },
          id: randomUUID(),
          projectId: task.projectId,
          taskId,
        });
        let completionUndo: TaskArchiveUndoReceipt | undefined;
        let recurrenceSuccessorId: string | undefined;
        if (task.status !== "done" && rawInput.status === "done") {
          recurrenceSuccessorId = await createRecurrenceSuccessor(
            transaction,
            recurrence,
            task,
            actorId,
            version,
            rawInput.dueDate,
            description,
            rawInput.priority,
            title,
            assigneeIds,
            now
          );
          const undoId = randomUUID();
          const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
          await transaction.orm.public.UndoRecord.create({
            action: "task.complete",
            actorId,
            createdAt: now,
            entityId: taskId,
            entityType: "task",
            expiresAt,
            id: undoId,
            snapshot: { status: decodeTaskStatus(task.status), version },
          });
          completionUndo = { expiresAt: expiresAt.toISOString(), undoId };
        }
        return {
          assigneeIds,
          createdById: task.createdById,
          ...(completionUndo ? { completionUndo } : {}),
          ...(recurrenceSuccessorId ? { recurrenceSuccessorId } : {}),
          description,
          dueDate: rawInput.dueDate,
          id: task.id,
          priority: rawInput.priority,
          projectId: task.projectId,
          projectTaskNumber: task.projectTaskNumber,
          status: rawInput.status,
          title,
          version,
        };
      });
    },
  });
const moveTask = (
  actorId: string,
  taskId: string,
  destinationProjectId: string,
  expectedVersion: number
): Effect.Effect<CreatedTask, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => {
      if (
        !Schema.is(Schema.String.check(Schema.isUUID()))(taskId) ||
        !Schema.is(Schema.String.check(Schema.isUUID()))(
          destinationProjectId
        ) ||
        !Number.isSafeInteger(expectedVersion) ||
        expectedVersion < 1
      ) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message:
            "A valid task, destination project, and task version are required.",
        });
      }
      return db.transaction(async (transaction) => {
        const actor = await transaction.orm.public.User.where({ id: actorId })
          .select("name", "role", "mustChangePassword", "deactivatedAt")
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
        const task = await transaction.orm.public.Task.where({
          id: taskId,
        }).first();
        if (!task) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The task was not found.",
          });
        }
        if (task.archivedAt) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "Archived tasks are read only.",
          });
        }
        if (task.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        const [assignments, projects, pendingUpload] = await Promise.all([
          transaction.orm.public.TaskAssignee.where({ taskId })
            .select("userId")
            .all(),
          transaction.orm.public.Project.where((project) =>
            project.id.in([task.projectId, destinationProjectId])
          ).all(),
          transaction.orm.public.UploadIntent.where({
            state: "pending",
            taskId,
          })
            .select("id")
            .first(),
        ]);
        if (
          actor.role !== "admin" &&
          task.createdById !== actorId &&
          !assignments.some(({ userId }) => userId === actorId)
        ) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "You cannot edit this task.",
          });
        }
        if (task.projectId === destinationProjectId) {
          throw new AppError({
            code: "VALIDATION_FAILED",
            message: "Choose a different destination project.",
          });
        }
        const destination = projects.find(
          ({ id }) => id === destinationProjectId
        );
        if (projects.length !== 2 || !destination) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The source or destination project was not found.",
          });
        }
        if (projects.some(({ archivedAt }) => archivedAt)) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "Archived projects cannot receive moved tasks.",
          });
        }
        if (pendingUpload) {
          throw new AppError({
            code: "CONFLICT",
            message:
              "Finish or cancel pending uploads before moving this task.",
          });
        }
        const [projectTaskNumber, destinationTasks, files] = await Promise.all([
          allocateTaskNumber(transaction, destinationProjectId),
          transaction.orm.public.Task.where({ projectId: destinationProjectId })
            .select("position")
            .all(),
          transaction.orm.public.FileAsset.where({ taskId }).select("id").all(),
        ]);
        let position = -1;
        for (const destinationTask of destinationTasks) {
          position = Math.max(position, destinationTask.position);
        }
        position += 1;
        const version = expectedVersion + 1;
        const now = new Date();
        const moved = await transaction.orm.public.Task.where({
          id: taskId,
          version: expectedVersion,
        }).updateAndCount({
          position,
          projectId: destinationProjectId,
          projectTaskNumber,
          updatedAt: now,
          version,
        });
        if (!moved) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        await Promise.all(
          files.map(({ id }) =>
            transaction.orm.public.FileAsset.where({ id }).update({
              projectId: destinationProjectId,
            })
          )
        );
        await transaction.orm.public.Activity.create({
          action: "task.moved",
          actorId,
          createdAt: now,
          details: {
            fromProjectId: task.projectId,
            toProjectId: destinationProjectId,
          },
          id: randomUUID(),
          projectId: destinationProjectId,
          taskId,
        });
        return {
          assigneeIds: assignments.map(({ userId }) => userId),
          createdById: task.createdById,
          description: task.description,
          dueDate: task.dueDate,
          id: taskId,
          priority: decodeTaskPriority(task.priority),
          projectId: destinationProjectId,
          projectTaskNumber,
          status: decodeTaskStatus(task.status),
          title: task.title,
          version,
        };
      });
    },
  });
const duplicateTask = (
  actorId: string,
  taskId: string,
  expectedVersion: number
): Effect.Effect<CreatedTask, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => {
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "A valid task version is required.",
        });
      }
      return db.transaction(async (transaction) => {
        const actor = await transaction.orm.public.User.where({ id: actorId })
          .select("name", "role", "mustChangePassword", "deactivatedAt")
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
        const source = await transaction.orm.public.Task.include("project")
          .where({ id: taskId })
          .first();
        if (!source) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The task was not found.",
          });
        }
        if (source.archivedAt || source.project.archivedAt) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "Archived work is read only.",
          });
        }
        if (source.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        const [assignments, labels, subtasks, projectTasks] = await Promise.all(
          [
            transaction.orm.public.TaskAssignee.include("user")
              .where({ taskId })
              .all(),
            transaction.orm.public.TaskLabel.where({ taskId })
              .select("labelId")
              .all(),
            transaction.orm.public.TaskSubtask.where({ taskId }).all(),
            transaction.orm.public.Task.where({ projectId: source.projectId })
              .select("position")
              .all(),
          ]
        );
        const activeAssignments = assignments.filter(
          ({ user }) => !user.deactivatedAt
        );
        if (
          actor.role !== "admin" &&
          source.createdById !== actorId &&
          !activeAssignments.some(({ userId }) => userId === actorId)
        ) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "You cannot edit this task.",
          });
        }
        const projectTaskNumber = await allocateTaskNumber(
          transaction,
          source.projectId
        );
        let position = -1;
        for (const task of projectTasks) {
          position = Math.max(position, task.position);
        }
        position += 1;
        const id = randomUUID();
        const now = new Date();
        const titleSuffix = " (copy)";
        const title = `${source.title.slice(0, 240 - titleSuffix.length)}${titleSuffix}`;
        await transaction.orm.public.Task.create({
          archivedAt: null,
          archivedById: null,
          completedAt: null,
          createdAt: now,
          createdById: actorId,
          description: source.description,
          dueDate: source.dueDate,
          estimate: source.estimate,
          id,
          position,
          priority: decodeTaskPriority(source.priority),
          projectId: source.projectId,
          projectTaskNumber,
          startDate: source.startDate,
          status: "todo" as const,
          title,
          updatedAt: now,
          version: 1,
        });
        await Promise.all([
          ...activeAssignments.map(({ userId }) =>
            transaction.orm.public.TaskAssignee.create({
              assignedAt: now,
              assignedById: actorId,
              taskId: id,
              userId,
            })
          ),
          ...labels.map(({ labelId }) =>
            transaction.orm.public.TaskLabel.create({ labelId, taskId: id })
          ),
          ...subtasks.map((subtask) =>
            transaction.orm.public.TaskSubtask.create({
              assigneeId:
                subtask.assigneeId &&
                !assignments.some(
                  ({ userId, user }) =>
                    userId === subtask.assigneeId && user.deactivatedAt
                )
                  ? subtask.assigneeId
                  : null,
              completedAt: null,
              createdAt: now,
              description: subtask.description,
              dueDate: subtask.dueDate,
              id: randomUUID(),
              isCompleted: false,
              position: subtask.position,
              taskId: id,
              title: subtask.title,
            })
          ),
        ]);
        await transaction.orm.public.Activity.create({
          action: "task.duplicated",
          actorId,
          createdAt: now,
          details: { sourceTaskId: taskId },
          id: randomUUID(),
          projectId: source.projectId,
          taskId: id,
        });
        return {
          assigneeIds: activeAssignments.map(({ userId }) => userId),
          createdById: actorId,
          description: source.description,
          dueDate: source.dueDate,
          id,
          priority: decodeTaskPriority(source.priority),
          projectId: source.projectId,
          projectTaskNumber,
          status: "todo" as const,
          title,
          version: 1,
        };
      });
    },
  });
const requireTaskAdmin = async (
  transaction: Transaction,
  actorId: string
): Promise<void> => {
  const actor = await transaction.orm.public.User.where({ id: actorId })
    .select("name", "role", "mustChangePassword", "deactivatedAt")
    .first();
  if (!actor || actor.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (actor.role !== "admin" || actor.mustChangePassword) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "An admin account with a changed password is required.",
    });
  }
};
const archiveTask = (
  actorId: string,
  taskId: string,
  expectedVersion: number
): Effect.Effect<TaskArchiveUndoReceipt, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => {
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "A valid task version is required.",
        });
      }
      return db.transaction(async (transaction) => {
        await requireTaskAdmin(transaction, actorId);
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
            code: "CONFLICT",
            message: "The task or its project is already archived.",
          });
        }
        if (task.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        const now = new Date();
        const version = expectedVersion + 1;
        const updated = await transaction.orm.public.Task.where({
          id: taskId,
          version: expectedVersion,
        }).updateAndCount({
          archivedAt: now,
          archivedById: actorId,
          updatedAt: now,
          version,
        });
        if (!updated) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        const undoId = randomUUID();
        const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
        await transaction.orm.public.UndoRecord.create({
          action: "task.archive",
          actorId,
          consumedAt: null,
          createdAt: now,
          entityId: taskId,
          entityType: "task",
          expiresAt,
          id: undoId,
          snapshot: { version },
        });
        await transaction.orm.public.Activity.create({
          action: "task.archived",
          actorId,
          createdAt: now,
          details: { version },
          id: randomUUID(),
          projectId: task.projectId,
          taskId,
        });
        return { expiresAt: expiresAt.toISOString(), undoId };
      });
    },
  });
const undoTaskArchive = (
  actorId: string,
  undoId: string
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () =>
      db.transaction(async (transaction) => {
        await requireTaskAdmin(transaction, actorId);
        const undo = await transaction.orm.public.UndoRecord.where({
          id: undoId,
        }).first();
        if (!undo) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The undo request was not found.",
          });
        }
        if (undo.actorId !== actorId) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "This undo request belongs to another user.",
          });
        }
        if (undo.action !== "task.archive" || undo.entityType !== "task") {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The undo request was not found.",
          });
        }
        if (undo.consumedAt || undo.expiresAt <= new Date()) {
          throw new AppError({
            code: "CONFLICT",
            message: "This undo request has expired or was already used.",
          });
        }
        const archivedVersion =
          typeof undo.snapshot === "object" &&
          undo.snapshot !== null &&
          "version" in undo.snapshot &&
          typeof undo.snapshot.version === "number"
            ? undo.snapshot.version
            : null;
        if (!archivedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The undo request no longer matches the task.",
          });
        }
        const task = await transaction.orm.public.Task.where({
          id: undo.entityId,
        }).first();
        if (!task) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The task was not found.",
          });
        }
        if (
          !task.archivedAt ||
          task.archivedById !== actorId ||
          task.version !== archivedVersion
        ) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed after it was archived.",
          });
        }
        const now = new Date();
        const restored = await transaction.orm.public.Task.where({
          archivedById: actorId,
          id: task.id,
          version: archivedVersion,
        }).updateAndCount({
          archivedAt: null,
          archivedById: null,
          updatedAt: now,
          version: archivedVersion + 1,
        });
        if (!restored) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed after it was archived.",
          });
        }
        const consumed = await transaction.orm.public.UndoRecord.where({
          consumedAt: null,
          id: undoId,
        }).updateAndCount({ consumedAt: now });
        if (!consumed) {
          throw new AppError({
            code: "CONFLICT",
            message: "This undo request has expired or was already used.",
          });
        }
        await transaction.orm.public.Activity.create({
          action: "task.archive_undone",
          actorId,
          createdAt: now,
          details: { undoId },
          id: randomUUID(),
          projectId: task.projectId,
          taskId: task.id,
        });
      }),
  });

const undoTaskCompletion = (
  actorId: string,
  undoId: string
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () =>
      db.transaction(async (transaction) => {
        const undo = await transaction.orm.public.UndoRecord.where({
          action: "task.complete",
          actorId,
          entityType: "task",
          id: undoId,
        }).first();
        if (!undo) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The completion undo request was not found.",
          });
        }
        const now = new Date();
        if (undo.consumedAt || undo.expiresAt <= now) {
          throw new AppError({
            code: "CONFLICT",
            message: "This completion undo request has expired or was used.",
          });
        }
        let snapshot: typeof TaskCompletionSnapshotSchema.Type;
        try {
          snapshot = Schema.decodeUnknownSync(TaskCompletionSnapshotSchema)(
            undo.snapshot
          );
        } catch {
          throw new AppError({
            code: "CONFLICT",
            message: "The completion undo request is invalid.",
          });
        }
        const reopened = await transaction.orm.public.Task.where({
          id: undo.entityId,
          status: "done",
          version: snapshot.version,
        }).updateAndCount({
          completedAt: null,
          status: snapshot.status,
          updatedAt: now,
          version: snapshot.version + 1,
        });
        if (!reopened) {
          throw new AppError({
            code: "CONFLICT",
            message:
              "The task changed after completion; undo is no longer safe.",
          });
        }
        const task = await transaction.orm.public.Task.where({
          id: undo.entityId,
        }).first();
        if (!task) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The task was not found.",
          });
        }
        const consumed = await transaction.orm.public.UndoRecord.where({
          consumedAt: null,
          id: undoId,
        }).updateAndCount({ consumedAt: now });
        if (!consumed) {
          throw new AppError({
            code: "CONFLICT",
            message: "This completion undo request has expired or was used.",
          });
        }
        await transaction.orm.public.Activity.create({
          action: "task.completion_undone",
          actorId,
          createdAt: now,
          details: { undoId },
          id: randomUUID(),
          projectId: task.projectId,
          taskId: task.id,
        });
      }),
  });
const restoreTask = (
  actorId: string,
  taskId: string,
  expectedVersion: number
): Effect.Effect<CreatedTask, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () =>
      db.transaction(async (transaction) => {
        await requireTaskAdmin(transaction, actorId);
        const task = await transaction.orm.public.Task.include("project")
          .where({ id: taskId })
          .first();
        if (!task) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The task was not found.",
          });
        }
        if (!task.archivedAt || task.project.archivedAt) {
          throw new AppError({
            code: "CONFLICT",
            message:
              "The task is not restorable while it or its project is active or archived.",
          });
        }
        if (task.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        const version = expectedVersion + 1;
        const now = new Date();
        const restored = await transaction.orm.public.Task.where({
          id: taskId,
          version: expectedVersion,
        }).updateAndCount({
          archivedAt: null,
          archivedById: null,
          updatedAt: now,
          version,
        });
        if (!restored) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        const assignees = await transaction.orm.public.TaskAssignee.where({
          taskId,
        })
          .orderBy((assignment) => assignment.userId.asc())
          .select("userId")
          .all();
        await transaction.orm.public.Activity.create({
          action: "task.restored",
          actorId,
          createdAt: now,
          details: { version },
          id: randomUUID(),
          projectId: task.projectId,
          taskId,
        });
        return {
          assigneeIds: assignees.map(({ userId }) => userId),
          createdById: task.createdById,
          description: task.description,
          dueDate: task.dueDate,
          id: task.id,
          priority: decodeTaskPriority(task.priority),
          projectId: task.projectId,
          projectTaskNumber: task.projectTaskNumber,
          status: decodeTaskStatus(task.status),
          title: task.title,
          version,
        };
      }),
  });
const bulkUpdateTasks = (
  actorId: string,
  targets: readonly BulkTaskTarget[],
  changes: BulkTaskChanges
): Effect.Effect<readonly CreatedTask[], AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => {
      if (
        targets.length === 0 ||
        targets.length > 100 ||
        new Set(targets.map(({ taskId }) => taskId)).size !== targets.length ||
        targets.some(
          ({ expectedVersion }) =>
            !Number.isSafeInteger(expectedVersion) || expectedVersion < 1
        )
      ) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message:
            "Bulk changes require 1 to 100 unique tasks with valid versions.",
        });
      }
      const assigneeIds = [...new Set(changes.assigneeIds)];
      if (assigneeIds.length > 100) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "A task can have at most 100 assignees.",
        });
      }
      if (
        changes.dueDate !== null &&
        !Schema.is(CalendarDateSchema)(changes.dueDate)
      ) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Enter a valid due date.",
        });
      }
      const targetsById = new Map(
        targets.map((target) => [target.taskId, target])
      );
      const taskIds = [...targetsById.keys()];
      return db.transaction(async (transaction) => {
        const actor = await transaction.orm.public.User.where({ id: actorId })
          .select("name", "role", "mustChangePassword", "deactivatedAt")
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
        const [tasks, assignments, activeUsers] = await Promise.all([
          transaction.orm.public.Task.include("project")
            .where((task) => task.id.in(taskIds))
            .all(),
          transaction.orm.public.TaskAssignee.where((assignment) =>
            assignment.taskId.in(taskIds)
          )
            .select("taskId", "userId")
            .all(),
          transaction.orm.public.User.where((user) => user.id.in(assigneeIds))
            .select("id", "deactivatedAt")
            .all(),
        ]);
        if (tasks.length !== targets.length) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "One or more tasks were not found.",
          });
        }
        if (
          activeUsers.length !== assigneeIds.length ||
          activeUsers.some(({ deactivatedAt }) => deactivatedAt)
        ) {
          throw new AppError({
            code: "VALIDATION_FAILED",
            message: "Choose active employees for every assignee.",
          });
        }
        const assignmentsByTask = new Map<string, Set<string>>();
        for (const assignment of assignments) {
          const taskAssignments =
            assignmentsByTask.get(assignment.taskId) ?? new Set<string>();
          taskAssignments.add(assignment.userId);
          assignmentsByTask.set(assignment.taskId, taskAssignments);
        }
        for (const task of tasks) {
          if (task.archivedAt || task.project.archivedAt) {
            throw new AppError({
              code: "FORBIDDEN",
              message: "Archived work is read only.",
            });
          }
          if (task.version !== targetsById.get(task.id)?.expectedVersion) {
            throw new AppError({
              code: "CONFLICT",
              message: "One or more tasks changed. Refresh and try again.",
            });
          }
          if (
            actor.role !== "admin" &&
            task.createdById !== actorId &&
            !assignmentsByTask.get(task.id)?.has(actorId)
          ) {
            throw new AppError({
              code: "FORBIDDEN",
              message: "You cannot edit every selected task.",
            });
          }
        }
        const now = new Date();
        const updatedTasks = await Promise.all(
          tasks.map(async (task) => {
            const expectedVersion = targetsById.get(task.id)?.expectedVersion;
            if (!expectedVersion) {
              throw new AppError({
                code: "CONFLICT",
                message: "One or more tasks changed. Refresh and try again.",
              });
            }
            const updatedCount = await transaction.orm.public.Task.where({
              id: task.id,
              version: expectedVersion,
            }).updateAndCount({
              completedAt:
                changes.status === "done" ? (task.completedAt ?? now) : null,
              dueDate: changes.dueDate,
              priority: changes.priority,
              status: changes.status,
              updatedAt: now,
              version: expectedVersion + 1,
            });
            if (!updatedCount) {
              throw new AppError({
                code: "CONFLICT",
                message: "One or more tasks changed. Refresh and try again.",
              });
            }
            const updated = await transaction.orm.public.Task.where({
              id: task.id,
            }).first();
            if (!updated) {
              throw new AppError({
                code: "NOT_FOUND",
                message: "One or more tasks were not found.",
              });
            }
            return updated;
          })
        );
        await transaction.orm.public.TaskAssignee.where((assignment) =>
          assignment.taskId.in(taskIds)
        ).deleteAll();
        await Promise.all(
          updatedTasks.flatMap((task) =>
            assigneeIds.map((userId) =>
              transaction.orm.public.TaskAssignee.create({
                assignedAt: now,
                assignedById: actorId,
                taskId: task.id,
                userId,
              })
            )
          )
        );
        await Promise.all(
          updatedTasks.map((task) =>
            transaction.orm.public.Activity.create({
              action: "task.bulk_updated",
              actorId,
              createdAt: now,
              details: { count: targets.length, status: changes.status },
              id: randomUUID(),
              projectId: task.projectId,
              taskId: task.id,
            })
          )
        );
        return updatedTasks.map((task) => ({
          assigneeIds,
          createdById: task.createdById,
          description: task.description,
          dueDate: task.dueDate,
          id: task.id,
          priority: decodeTaskPriority(task.priority),
          projectId: task.projectId,
          projectTaskNumber: task.projectTaskNumber,
          status: decodeTaskStatus(task.status),
          title: task.title,
          version: task.version,
        }));
      });
    },
  });
const changeTaskStatus = (
  actorId: string,
  taskId: string,
  expectedVersion: number,
  status: UpdateTaskInput["status"]
): Effect.Effect<CreatedTask, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      const task = await db.orm.public.Task.where({ id: taskId })
        .select("description", "dueDate", "priority", "title")
        .first();
      if (!task) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "The task was not found.",
        });
      }
      const assignments = await db.orm.public.TaskAssignee.where({ taskId })
        .select("userId")
        .all();
      return updateTask(actorId, taskId, expectedVersion, {
        assigneeIds: assignments.map(({ userId }) => userId),
        description: task.description,
        dueDate: task.dueDate,
        priority: decodeTaskPriority(task.priority),
        status,
        title: task.title,
      });
    },
  }).pipe(Effect.flatten);

const listProjectTasks = (
  actorId: string,
  projectId: string,
  pagination: { readonly limit: number; readonly offset: number }
): Effect.Effect<readonly ProjectTaskListItem[], AppError> =>
  Effect.tryPromise({
    catch: databaseError,
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
      if (
        !Schema.is(Schema.String.check(Schema.isUUID()))(projectId) ||
        !Number.isInteger(pagination.limit) ||
        pagination.limit < 1 ||
        pagination.limit > 200 ||
        !Number.isInteger(pagination.offset) ||
        pagination.offset < 0
      ) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "The project task query is invalid.",
        });
      }
      const project = await db.orm.public.Project.where({ id: projectId })
        .select("id")
        .first();
      if (!project) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "The project was not found.",
        });
      }
      const tasks = await db.orm.public.Task.where({ projectId })
        .orderBy((task) => task.position.asc())
        .orderBy((task) => task.projectTaskNumber.asc())
        .limit(pagination.limit)
        .offset(pagination.offset)
        .all();
      const taskIds = tasks.map(({ id }) => id);
      if (taskIds.length === 0) {
        return [];
      }
      const [assignments, labels, dependencies, subtasks] = await Promise.all([
        db.orm.public.TaskAssignee.include("user")
          .where((assignment) => assignment.taskId.in(taskIds))
          .all(),
        db.orm.public.TaskLabel.where((label) =>
          label.taskId.in(taskIds)
        ).all(),
        db.orm.public.TaskDependency.where((dependency) =>
          dependency.taskId.in(taskIds)
        ).all(),
        db.orm.public.TaskSubtask.where((subtask) =>
          subtask.taskId.in(taskIds)
        ).all(),
      ]);
      const assignmentsByTask = new Map<string, typeof assignments>();
      for (const assignment of assignments) {
        const rows = assignmentsByTask.get(assignment.taskId) ?? [];
        rows.push(assignment);
        assignmentsByTask.set(assignment.taskId, rows);
      }
      const labelsByTask = new Map<string, string[]>();
      for (const label of labels) {
        const ids = labelsByTask.get(label.taskId) ?? [];
        ids.push(label.labelId);
        labelsByTask.set(label.taskId, ids);
      }
      const dependenciesByTask = new Map<string, string[]>();
      for (const dependency of dependencies) {
        const ids = dependenciesByTask.get(dependency.taskId) ?? [];
        ids.push(dependency.dependsOnTaskId);
        dependenciesByTask.set(dependency.taskId, ids);
      }
      const subtasksByTask = new Map<string, typeof subtasks>();
      for (const subtask of subtasks) {
        const rows = subtasksByTask.get(subtask.taskId) ?? [];
        rows.push(subtask);
        subtasksByTask.set(subtask.taskId, rows);
      }
      return tasks.map((task) => {
        const taskAssignments = assignmentsByTask.get(task.id) ?? [];
        const taskLabels = labelsByTask.get(task.id) ?? [];
        const taskDependencies = dependenciesByTask.get(task.id) ?? [];
        const taskSubtasks = subtasksByTask.get(task.id) ?? [];
        return {
          archivedAt: task.archivedAt?.toISOString() ?? null,
          assigneeIds: taskAssignments.map(({ userId }) => userId),
          assignees: taskAssignments.map(({ user }) => ({
            id: user.id,
            name: user.name,
          })),
          completedAt: task.completedAt?.toISOString() ?? null,
          completedSubtaskCount: taskSubtasks.filter(
            ({ isCompleted }) => isCompleted
          ).length,
          createdById: task.createdById,
          dependencyIds: taskDependencies,
          description: task.description,
          dueDate: task.dueDate,
          estimate: task.estimate,
          id: task.id,
          labelIds: taskLabels,
          position: task.position,
          priority: decodeTaskPriority(task.priority),
          projectId: task.projectId,
          projectTaskNumber: task.projectTaskNumber,
          startDate: task.startDate,
          status: decodeTaskStatus(task.status),
          subtaskCount: taskSubtasks.length,
          title: task.title,
          version: task.version,
        };
      });
    },
  });

export const WorkManagementLive = Layer.succeed(
  WorkManagement,
  WorkManagement.of({
    archiveTask,
    bulkUpdateTasks,
    changeTaskStatus,
    createTask,
    duplicateTask,
    listProjectTasks,
    moveTask,
    restoreTask,
    setTaskRecurrence,
    undoTaskArchive,
    undoTaskCompletion,
    updateTask,
  })
);
