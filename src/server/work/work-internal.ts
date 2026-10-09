import { Schema } from "effect";
import sanitizeHtml from "sanitize-html";

import type { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { CalendarDateSchema } from "../core/input-schemas";
import { isUniqueConstraintViolation } from "../core/prisma-errors";
import type { CreateTaskInput } from "./work-contracts";

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

export const validateInput = (input: CreateTaskInput): CreateTaskInput => {
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

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
