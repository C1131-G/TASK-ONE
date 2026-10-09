import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { CreatedTask } from "../work/work-contracts";
import { allocateTaskNumber } from "../work/work-task-creation";
import {
  mapError,
  advanceParent,
  nextPosition,
  requireEditableTask,
  validateAssignee,
  writeActivity,
} from "./subtask-internal";

export const promoteSubtask = (
  actorId: string,
  subtaskId: string,
  expectedTaskVersion: number
): Effect.Effect<CreatedTask, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () =>
      db.transaction(async (transaction) => {
        const subtask = await transaction.orm.public.TaskSubtask.where({
          id: subtaskId,
        }).first();
        if (!subtask) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The subtask was not found.",
          });
        }
        const parent = await requireEditableTask(
          transaction,
          actorId,
          subtask.taskId,
          expectedTaskVersion
        );
        await validateAssignee(transaction, subtask.assigneeId);
        const [projectTaskNumber, tasks] = await Promise.all([
          allocateTaskNumber(transaction, parent.projectId),
          transaction.orm.public.Task.where({ projectId: parent.projectId })
            .select("position")
            .all(),
        ]);
        const position = nextPosition(tasks.map((row) => row.position));
        const id = randomUUID();
        const now = new Date();
        await transaction.orm.public.Task.create({
          archivedAt: null,
          archivedById: null,
          completedAt: null,
          createdAt: now,
          createdById: actorId,
          description: subtask.description,
          dueDate: subtask.dueDate,
          estimate: null,
          id,
          position,
          priority: "none",
          projectId: parent.projectId,
          projectTaskNumber,
          startDate: null,
          status: "todo",
          title: subtask.title,
          updatedAt: now,
          version: 1,
        });
        if (subtask.assigneeId) {
          await transaction.orm.public.TaskAssignee.create({
            assignedAt: now,
            assignedById: actorId,
            taskId: id,
            userId: subtask.assigneeId,
          });
        }
        await transaction.orm.public.TaskSubtask.where({
          id: subtaskId,
        }).delete();
        await advanceParent(transaction, parent.id, expectedTaskVersion);
        await writeActivity(
          transaction,
          actorId,
          id,
          parent.projectId,
          "subtask.promoted",
          { parentTaskId: parent.id, subtaskId }
        );
        return {
          assigneeIds: subtask.assigneeId ? [subtask.assigneeId] : [],
          createdById: actorId,
          description: subtask.description,
          dueDate: subtask.dueDate,
          id,
          priority: "none" as const,
          projectId: parent.projectId,
          projectTaskNumber,
          status: "todo" as const,
          title: subtask.title,
          version: 1,
        };
      }),
  });
