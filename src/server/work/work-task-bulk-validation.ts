import { Schema } from "effect";

import { AppError } from "../core/action-result";
import { CalendarDateSchema } from "../core/input-schemas";
import type { BulkTaskChanges, BulkTaskTarget } from "./work-contracts";

export const validateBulkTaskInput = (
  targets: readonly BulkTaskTarget[],
  changes: BulkTaskChanges
) => {
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
  const targetsById = new Map(targets.map((target) => [target.taskId, target]));
  return {
    assigneeIds,
    targetsById,
    taskIds: [...targetsById.keys()],
  };
};
