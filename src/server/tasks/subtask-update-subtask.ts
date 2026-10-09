import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { UpdateSubtaskInput, UpdatedSubtask } from "./subtask-contracts";
import {
  mapError,
  advanceParent,
  decodeUpdateSubtaskInput,
  requireEditableTask,
  toEntry,
  validateAssignee,
  writeActivity,
} from "./subtask-internal";

export const updateSubtask = (
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
