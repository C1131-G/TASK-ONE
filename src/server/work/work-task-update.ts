import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type {
  CreatedTask,
  TaskArchiveUndoReceipt,
  UpdateTaskInput,
} from "./work-contracts";
import { decodeTaskStatus } from "./work-contracts";
import { databaseError } from "./work-internal";
import { notifyTaskAssignees } from "./work-notifications";
import {
  assertActiveTaskAssignees,
  assertTaskEditPermission,
  assertWorkspaceActor,
  createRecurrenceSuccessor,
  prepareTaskUpdate,
} from "./work-task-state";

export const updateTask = (
  actorId: string,
  taskId: string,
  expectedVersion: number,
  rawInput: UpdateTaskInput
): Effect.Effect<CreatedTask, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => {
      const { assigneeIds, description, title } = prepareTaskUpdate(
        rawInput,
        expectedVersion
      );
      return db.transaction(async (transaction) => {
        const actor = await transaction.orm.public.User.where({ id: actorId })
          .select("name", "role", "mustChangePassword", "deactivatedAt")
          .first();
        assertWorkspaceActor(actor);
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
            message: "Archived tasks are read only.",
          });
        }
        if (task.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        const [assignments, activeAssignees, recurrence] = await Promise.all([
          transaction.orm.public.TaskAssignee.where({ taskId })
            .select("userId")
            .all(),
          transaction.orm.public.User.where((user) => user.id.in(assigneeIds))
            .select("id", "deactivatedAt")
            .all(),
          transaction.orm.public.TaskRecurrence.where({ taskId }).first(),
        ]);
        if (recurrence && !rawInput.dueDate) {
          throw new AppError({
            code: "VALIDATION_FAILED",
            message: "Remove recurrence before clearing the task due date.",
          });
        }
        assertTaskEditPermission(actor, actorId, task.createdById, assignments);
        assertActiveTaskAssignees(assigneeIds, activeAssignees);
        const now = new Date();
        const version = expectedVersion + 1;
        const updated = await transaction.orm.public.Task.where({
          id: taskId,
          version: expectedVersion,
        }).updateAndCount({
          completedAt:
            rawInput.status === "done" ? (task.completedAt ?? now) : null,
          description,
          dueDate: rawInput.dueDate,
          estimate: rawInput.estimate ?? task.estimate,
          priority: rawInput.priority,
          startDate: rawInput.startDate ?? task.startDate,
          status: rawInput.status,
          title,
          updatedAt: now,
          version,
        });
        if (!updated) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        if (recurrence && rawInput.dueDate !== task.dueDate) {
          await transaction.orm.public.TaskRecurrence.where({ taskId }).update({
            nextRunAt: rawInput.dueDate,
            updatedAt: now,
          });
        }
        await transaction.orm.public.TaskAssignee.where({ taskId }).deleteAll();
        await Promise.all(
          assigneeIds.map((userId) =>
            transaction.orm.public.TaskAssignee.create({
              assignedAt: now,
              assignedById: actorId,
              taskId,
              userId,
            })
          )
        );
        const previouslyAssigned = new Set(
          assignments.map(({ userId }) => userId)
        );
        await notifyTaskAssignees(
          transaction,
          { id: actorId, name: actor.name },
          { id: taskId, projectId: task.projectId, title },
          assigneeIds.filter((userId) => !previouslyAssigned.has(userId)),
          now
        );
        const existingStakeholders = [
          task.createdById,
          ...assigneeIds.filter((userId) => previouslyAssigned.has(userId)),
        ];
        await notifyTaskAssignees(
          transaction,
          { id: actorId, name: actor.name },
          { id: taskId, projectId: task.projectId, title },
          existingStakeholders,
          now,
          "update"
        );
        await transaction.orm.public.Activity.create({
          action: "task.updated",
          actorId,
          createdAt: now,
          details: { taskId, version },
          id: randomUUID(),
          projectId: task.projectId,
          taskId,
        });
        let completionUndo: TaskArchiveUndoReceipt | undefined;
        let recurrenceSuccessorId: string | undefined;
        if (task.status !== "done" && rawInput.status === "done") {
          recurrenceSuccessorId = await createRecurrenceSuccessor(
            transaction,
            recurrence,
            task,
            actorId,
            version,
            rawInput.dueDate,
            description,
            rawInput.priority,
            title,
            assigneeIds,
            now
          );
          const undoId = randomUUID();
          const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
          await transaction.orm.public.UndoRecord.create({
            action: "task.complete",
            actorId,
            createdAt: now,
            entityId: taskId,
            entityType: "task",
            expiresAt,
            id: undoId,
            snapshot: { status: decodeTaskStatus(task.status), version },
          });
          completionUndo = { expiresAt: expiresAt.toISOString(), undoId };
        }
        return {
          assigneeIds,
          createdById: task.createdById,
          ...(completionUndo ? { completionUndo } : {}),
          ...(recurrenceSuccessorId ? { recurrenceSuccessorId } : {}),
          description,
          dueDate: rawInput.dueDate,
          id: task.id,
          priority: rawInput.priority,
          projectId: task.projectId,
          projectTaskNumber: task.projectTaskNumber,
          status: rawInput.status,
          title,
          version,
        };
      });
    },
  });
