import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import type { AppError } from "../core/action-result";
import type { SubtaskFields, CreatedSubtask } from "./subtask-contracts";
import {
  mapError,
  advanceParent,
  decodeSubtaskFields,
  nextPosition,
  requireEditableTask,
  toEntry,
  validateAssignee,
  writeActivity,
} from "./subtask-internal";

export const createSubtask = (
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
