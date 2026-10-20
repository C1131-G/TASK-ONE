import { Schema } from "effect";

import type { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { CalendarDateSchema } from "../core/input-schemas";
import { isUniqueConstraintViolation } from "../core/prisma-errors";
import { sanitizeDescription } from "./sanitize-description";
import type { CreateTaskInput } from "./work-contracts";
import {
  TASK_DESCRIPTION_MAX_LENGTH,
  TaskDescriptionSchema,
} from "./work-contracts";

export const assertTaskDescriptionLength = (
  description: string | null
): void => {
  if (!Schema.is(TaskDescriptionSchema)(description)) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: `Keep the task description under ${TASK_DESCRIPTION_MAX_LENGTH.toLocaleString("en-US")} characters.`,
    });
  }
};

export const databaseError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  if (isUniqueConstraintViolation(error)) {
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

export const assertOrdinaryTask = (task: { readonly type: string }): void => {
  if (task.type === "bug") {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Manage bug workflow changes from the Bugs workspace.",
    });
  }
};

export const validateInput = (input: CreateTaskInput): CreateTaskInput => {
  const title = input.title.trim();
  if (!input.projectId || !title || title.length > 240) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      field: "title",
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
      field: "dueDate",
      message: "Enter a valid due date.",
    });
  }
  assertTaskDescriptionLength(input.description);
  const assigneeIds = [...new Set(input.assigneeIds)];
  return {
    ...input,
    assigneeIds,
    description: sanitizeDescription(input.description),
    title,
  };
};

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const assertStartNotAfterDue = (
  startDate: string | null | undefined,
  dueDate: string | null
): void => {
  if (startDate && dueDate && startDate > dueDate) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "The start date must be on or before the due date.",
    });
  }
};
