import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type {
  BulkTaskChanges,
  BulkTaskTarget,
  CreatedTask,
  TaskArchiveUndoReceipt,
} from "./work-contracts";
import { decodeTaskPriority, decodeTaskStatus } from "./work-contracts";
import { databaseError } from "./work-internal";
import { notifyTaskAssignees } from "./work-notifications";
import { validateBulkTaskInput } from "./work-task-bulk-validation";
import { createRecurrenceSuccessor } from "./work-task-state";

export const bulkUpdateTasks = (
  actorId: string,
  targets: readonly BulkTaskTarget[],
  changes: BulkTaskChanges
): Effect.Effect<readonly CreatedTask[], AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => {
      const { assigneeIds, targetsById, taskIds } = validateBulkTaskInput(
        targets,
        changes
      );
      return db.transaction(async (transaction) => {
        const actor = await transaction.orm.public.User.where({ id: actorId })
          .select("name", "role", "mustChangePassword", "deactivatedAt")
          .first();
        if (!actor || actor.deactivatedAt) {
          throw new AppError({
            code: "UNAUTHENTICATED",
            message: "Sign in to continue.",
          });
        }
        if (actor.mustChangePassword) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "Change your password before continuing.",
          });
        }
        const [tasks, assignments, activeUsers, recurrences] =
          await Promise.all([
            transaction.orm.public.Task.include("project")
              .where((task) => task.id.in(taskIds))
              .all(),
            transaction.orm.public.TaskAssignee.where((assignment) =>
              assignment.taskId.in(taskIds)
            )
              .select("taskId", "userId")
              .all(),
            transaction.orm.public.User.where((user) => user.id.in(assigneeIds))
              .select("id", "deactivatedAt")
              .all(),
            transaction.orm.public.TaskRecurrence.where((recurrence) =>
              recurrence.taskId.in(taskIds)
            ).all(),
          ]);
        if (tasks.length !== targets.length) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "One or more tasks were not found.",
          });
        }
        if (
          activeUsers.length !== assigneeIds.length ||
          activeUsers.some(({ deactivatedAt }) => deactivatedAt)
        ) {
          throw new AppError({
            code: "VALIDATION_FAILED",
            message: "Choose active employees for every assignee.",
          });
        }
        const assignmentsByTask = new Map<string, Set<string>>();
        for (const assignment of assignments) {
          const taskAssignments =
            assignmentsByTask.get(assignment.taskId) ?? new Set<string>();
          taskAssignments.add(assignment.userId);
          assignmentsByTask.set(assignment.taskId, taskAssignments);
        }
        for (const task of tasks) {
          if (task.archivedAt || task.project.archivedAt) {
            throw new AppError({
              code: "FORBIDDEN",
              message: "Archived work is read only.",
            });
          }
          if (task.version !== targetsById.get(task.id)?.expectedVersion) {
            throw new AppError({
              code: "CONFLICT",
              message: "One or more tasks changed. Refresh and try again.",
            });
          }
          if (
            recurrences.some((recurrence) => recurrence.taskId === task.id) &&
            changes.dueDate === null
          ) {
            throw new AppError({
              code: "VALIDATION_FAILED",
              message: "Remove recurrence before clearing the task due date.",
            });
          }
          if (
            actor.role !== "admin" &&
            task.createdById !== actorId &&
            !assignmentsByTask.get(task.id)?.has(actorId)
          ) {
            throw new AppError({
              code: "FORBIDDEN",
              message: "You cannot edit every selected task.",
            });
          }
        }
        const now = new Date();
        const orderedTasks = tasks.toSorted((left, right) =>
          left.id.localeCompare(right.id)
        );
        const updatedTasks = await Promise.all(
          orderedTasks.map(async (task) => {
            const expectedVersion = targetsById.get(task.id)?.expectedVersion;
            if (!expectedVersion) {
              throw new AppError({
                code: "CONFLICT",
                message: "One or more tasks changed. Refresh and try again.",
              });
            }
            const updatedCount = await transaction.orm.public.Task.where({
              id: task.id,
              version: expectedVersion,
            }).updateAndCount({
              completedAt:
                changes.status === "done" ? (task.completedAt ?? now) : null,
              dueDate: changes.dueDate,
              priority: changes.priority,
              status: changes.status,
              updatedAt: now,
              version: expectedVersion + 1,
            });
            if (!updatedCount) {
              throw new AppError({
                code: "CONFLICT",
                message: "One or more tasks changed. Refresh and try again.",
              });
            }
            const updated = await transaction.orm.public.Task.where({
              id: task.id,
            }).first();
            if (!updated) {
              throw new AppError({
                code: "NOT_FOUND",
                message: "One or more tasks were not found.",
              });
            }
            return updated;
          })
        );
        await transaction.orm.public.TaskAssignee.where((assignment) =>
          assignment.taskId.in(taskIds)
        ).deleteAll();
        await Promise.all(
          updatedTasks.flatMap((task) =>
            assigneeIds.map((userId) =>
              transaction.orm.public.TaskAssignee.create({
                assignedAt: now,
                assignedById: actorId,
                taskId: task.id,
                userId,
              })
            )
          )
        );
        const updatedById = new Map(
          updatedTasks.map((task) => [task.id, task] as const)
        );
        const recurrenceByTaskId = new Map(
          recurrences.map(
            (recurrence) => [recurrence.taskId, recurrence] as const
          )
        );
        const results: CreatedTask[] = await Promise.all(
          orderedTasks.map(async (task) => {
            const updated = updatedById.get(task.id);
            if (!updated) {
              throw new AppError({
                code: "NOT_FOUND",
                message: "One or more tasks were not found.",
              });
            }
            const previousAssignees =
              assignmentsByTask.get(task.id) ?? new Set();
            await notifyTaskAssignees(
              transaction,
              { id: actorId, name: actor.name },
              { id: task.id, projectId: task.projectId, title: task.title },
              assigneeIds.filter((userId) => !previousAssignees.has(userId)),
              now
            );
            await notifyTaskAssignees(
              transaction,
              { id: actorId, name: actor.name },
              { id: task.id, projectId: task.projectId, title: task.title },
              [
                task.createdById,
                ...assigneeIds.filter((userId) =>
                  previousAssignees.has(userId)
                ),
              ],
              now,
              "update"
            );
            await transaction.orm.public.Activity.create({
              action: "task.bulk_updated",
              actorId,
              createdAt: now,
              details: { count: targets.length, status: changes.status },
              id: randomUUID(),
              projectId: task.projectId,
              taskId: task.id,
            });
            const completionTransition =
              task.status !== "done" && changes.status === "done";
            const successorId = completionTransition
              ? await createRecurrenceSuccessor(
                  transaction,
                  recurrenceByTaskId.get(task.id) ?? null,
                  task,
                  actorId,
                  updated.version,
                  changes.dueDate,
                  task.description,
                  changes.priority,
                  task.title,
                  assigneeIds,
                  now
                )
              : undefined;
            let completionUndo: TaskArchiveUndoReceipt | undefined;
            if (completionTransition) {
              const undoId = randomUUID();
              const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
              await transaction.orm.public.UndoRecord.create({
                action: "task.complete",
                actorId,
                createdAt: now,
                entityId: task.id,
                entityType: "task",
                expiresAt,
                id: undoId,
                snapshot: {
                  status: decodeTaskStatus(task.status),
                  version: updated.version,
                },
              });
              completionUndo = { expiresAt: expiresAt.toISOString(), undoId };
            }
            return {
              assigneeIds,
              createdById: task.createdById,
              ...(completionUndo ? { completionUndo } : {}),
              ...(successorId ? { recurrenceSuccessorId: successorId } : {}),
              description: task.description,
              dueDate: updated.dueDate,
              id: task.id,
              priority: decodeTaskPriority(updated.priority),
              projectId: task.projectId,
              projectTaskNumber: task.projectTaskNumber,
              status: decodeTaskStatus(updated.status),
              title: task.title,
              version: updated.version,
            };
          })
        );
        return results;
      });
    },
  });
