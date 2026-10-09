import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import {
  mapError,
  advanceParent,
  requireEditableTask,
  writeActivity,
} from "./subtask-internal";

export const removeSubtask = (
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
