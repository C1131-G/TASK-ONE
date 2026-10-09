import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { ReorderedSubtasksSchema } from "./subtask-contracts";
import {
  mapError,
  advanceParent,
  requireEditableTask,
  toEntry,
  writeActivity,
} from "./subtask-internal";

export const reorderSubtasks = (
  actorId: string,
  taskId: string,
  expectedTaskVersion: number,
  subtaskIds: readonly string[]
): Effect.Effect<typeof ReorderedSubtasksSchema.Type, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () =>
      db.transaction(async (transaction) => {
        const task = await requireEditableTask(
          transaction,
          actorId,
          taskId,
          expectedTaskVersion
        );
        const uniqueIds = new Set(subtaskIds);
        if (
          subtaskIds.length > 100 ||
          uniqueIds.size !== subtaskIds.length ||
          subtaskIds.some(
            (id) => !Schema.is(Schema.String.check(Schema.isUUID()))(id)
          )
        ) {
          throw new AppError({
            code: "VALIDATION_FAILED",
            message: "Choose a valid subtask ordering.",
          });
        }
        const current = await transaction.orm.public.TaskSubtask.where({
          taskId,
        }).all();
        if (
          current.length !== subtaskIds.length ||
          current.some((subtask) => !uniqueIds.has(subtask.id))
        ) {
          throw new AppError({
            code: "CONFLICT",
            message: "The subtask list changed. Refresh and try again.",
          });
        }
        const parentVersion = await advanceParent(
          transaction,
          taskId,
          expectedTaskVersion
        );
        await Promise.all(
          subtaskIds.map((id, position) =>
            transaction.orm.public.TaskSubtask.where({ id, taskId }).update({
              position,
            })
          )
        );
        await writeActivity(
          transaction,
          actorId,
          taskId,
          task.projectId,
          "subtask.reordered",
          { count: subtaskIds.length }
        );
        const rows = await transaction.orm.public.TaskSubtask.where({ taskId })
          .orderBy((subtask) => subtask.position.asc())
          .all();
        return {
          parentVersion,
          subtasks: rows.map(toEntry),
        };
      }),
  });
