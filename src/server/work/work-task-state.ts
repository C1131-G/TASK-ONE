import { randomUUID } from "node:crypto";

import type { ResultType } from "@prisma/orm-postgres/components/runtime";
import { Schema } from "effect";
import sanitizeHtml from "sanitize-html";

import type { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { CalendarDateSchema } from "../core/input-schemas";
import type {
  CreateTaskInput,
  TaskRecurrenceInput,
  UpdateTaskInput,
} from "./work-contracts";
import { TaskRecurrenceInputSchema } from "./work-contracts";
import type { Transaction } from "./work-internal";
import { allocateTaskNumber } from "./work-task-creation";
import { nextRecurrenceDate } from "./work-task-recurrence";

interface PreparedTaskUpdate {
  readonly title: string;
  readonly description: string | null;
  readonly assigneeIds: readonly string[];
}

export const prepareTaskUpdate = (
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

export const assertWorkspaceActor: (
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

export const assertTaskEditPermission = (
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

export const assertActiveTaskAssignees = (
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

export const createRecurrenceSuccessor = async (
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
    startDate: nextDueDate,
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
