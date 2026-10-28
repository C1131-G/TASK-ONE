import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { enqueueTaskFieldEvents } from "../automation/automation-enqueue";
import { AppError } from "../core/action-result";
import { enqueueTaskChange } from "../webhooks/webhook-task-event";
import type {
  CreatedTask,
  TaskArchiveUndoReceipt,
  UpdateTaskInput,
} from "./work-contracts";
import { decodeTaskStatus } from "./work-contracts";
import {
  assertOrdinaryTask,
  assertStartNotAfterDue,
  databaseError,
} from "./work-internal";
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
        assertOrdinaryTask(task);
        if (task.archivedAt || task.project.archivedAt) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "Archived tasks are read only.",
          });
        }
        // Who may edit comes before whether the version is current, so someone
        // who may not edit never learns that the task changed.
        const assignments = await transaction.orm.public.TaskAssignee.where({
          taskId,
        })
          .select("userId")
          .all();
        assertTaskEditPermission(actor, actorId, task.createdById, assignments);
        if (task.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        const [activeAssignees, recurrence] = await Promise.all([
          // Client accounts are never task assignees, so they read as missing.
          transaction.orm.public.User.where((user) =>
            and(user.id.in(assigneeIds), user.role.neq("client"))
          )
            .select("id", "deactivatedAt")
            .all(),
          transaction.orm.public.TaskRecurrence.where({ taskId }).first(),
        ]);
        const startDate =
          rawInput.startDate === undefined
            ? task.startDate
            : rawInput.startDate;
        assertStartNotAfterDue(startDate, rawInput.dueDate);
        if (recurrence && !rawInput.dueDate) {
          throw new AppError({
            code: "VALIDATION_FAILED",
            message: "Remove recurrence before clearing the task due date.",
          });
        }
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
          startDate,
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
        if (task.status !== rawInput.status) {
          await transaction.orm.public.Activity.create({
            action: "task.status_changed",
            actorId,
            createdAt: now,
            details: { from: task.status, to: rawInput.status },
            id: randomUUID(),
            projectId: task.projectId,
            taskId,
          });
        }
        await enqueueTaskChange(transaction, {
          dueDate: rawInput.dueDate,
          id: taskId,
          now,
          previousStatus: task.status,
          priority: rawInput.priority,
          projectId: task.projectId,
          projectTaskNumber: task.projectTaskNumber,
          status: rawInput.status,
          title,
        });
        await enqueueTaskFieldEvents(transaction, {
          after: {
            assigneeIds,
            dueDate: rawInput.dueDate,
            priority: rawInput.priority,
            status: rawInput.status,
          },
          before: {
            assigneeIds: [...previouslyAssigned],
            dueDate: task.dueDate,
            priority: task.priority,
            status: task.status,
          },
          now,
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
