import { randomUUID } from "node:crypto";

import type { ResultType } from "@prisma/orm-postgres/components/runtime";
import { Schema } from "effect";
import sanitizeHtml from "sanitize-html";

import type { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { isUniqueConstraintViolation } from "../core/prisma-errors";
import {
  SubtaskFieldsSchema,
  UpdateSubtaskInputSchema,
} from "./subtask-contracts";
import type {
  SubtaskFields,
  SubtaskEntry,
  UpdateSubtaskInput,
} from "./subtask-contracts";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type StoredSubtask = ResultType<typeof db.orm.public.TaskSubtask>;

export const mapError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  if (isUniqueConstraintViolation(error)) {
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

export const decodeSubtaskFields = (input: unknown): SubtaskFields => {
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

export const decodeUpdateSubtaskInput = (
  input: unknown
): UpdateSubtaskInput => {
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

export const requireEditableTask = async (
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

export const validateAssignee = async (
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

export const toEntry = (row: StoredSubtask): SubtaskEntry => ({
  assigneeId: row.assigneeId,
  completed: row.completedAt !== null,
  description: row.description,
  dueDate: row.dueDate,
  id: row.id,
  position: row.position,
  taskId: row.taskId,
  title: row.title,
});

export const writeActivity = async (
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

export const nextPosition = (positions: readonly number[]): number => {
  let highestPosition = -1;
  for (const position of positions) {
    highestPosition = Math.max(highestPosition, position);
  }
  return highestPosition + 1;
};

export const advanceParent = async (
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
