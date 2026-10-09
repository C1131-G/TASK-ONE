import { randomUUID } from "node:crypto";

import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { CreatedTask } from "./work-contracts";
import {
  TaskCompletionSnapshotSchema,
  decodeTaskPriority,
  decodeTaskStatus,
} from "./work-contracts";
import { databaseError } from "./work-internal";
import { requireTaskAdmin } from "./work-task-admin";

export const undoTaskCompletion = (
  actorId: string,
  undoId: string
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () =>
      db.transaction(async (transaction) => {
        const undo = await transaction.orm.public.UndoRecord.where({
          action: "task.complete",
          actorId,
          entityType: "task",
          id: undoId,
        }).first();
        if (!undo) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The completion undo request was not found.",
          });
        }
        const now = new Date();
        if (undo.consumedAt || undo.expiresAt <= now) {
          throw new AppError({
            code: "CONFLICT",
            message: "This completion undo request has expired or was used.",
          });
        }
        let snapshot: typeof TaskCompletionSnapshotSchema.Type;
        try {
          snapshot = Schema.decodeUnknownSync(TaskCompletionSnapshotSchema)(
            undo.snapshot
          );
        } catch {
          throw new AppError({
            code: "CONFLICT",
            message: "The completion undo request is invalid.",
          });
        }
        const reopened = await transaction.orm.public.Task.where({
          id: undo.entityId,
          status: "done",
          version: snapshot.version,
        }).updateAndCount({
          completedAt: null,
          status: snapshot.status,
          updatedAt: now,
          version: snapshot.version + 1,
        });
        if (!reopened) {
          throw new AppError({
            code: "CONFLICT",
            message:
              "The task changed after completion; undo is no longer safe.",
          });
        }
        const task = await transaction.orm.public.Task.where({
          id: undo.entityId,
        }).first();
        if (!task) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The task was not found.",
          });
        }
        const consumed = await transaction.orm.public.UndoRecord.where({
          consumedAt: null,
          id: undoId,
        }).updateAndCount({ consumedAt: now });
        if (!consumed) {
          throw new AppError({
            code: "CONFLICT",
            message: "This completion undo request has expired or was used.",
          });
        }
        await transaction.orm.public.Activity.create({
          action: "task.completion_undone",
          actorId,
          createdAt: now,
          details: { undoId },
          id: randomUUID(),
          projectId: task.projectId,
          taskId: task.id,
        });
      }),
  });
export const restoreTask = (
  actorId: string,
  taskId: string,
  expectedVersion: number
): Effect.Effect<CreatedTask, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () =>
      db.transaction(async (transaction) => {
        await requireTaskAdmin(transaction, actorId);
        const task = await transaction.orm.public.Task.include("project")
          .where({ id: taskId })
          .first();
        if (!task) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The task was not found.",
          });
        }
        if (!task.archivedAt || task.project.archivedAt) {
          throw new AppError({
            code: "CONFLICT",
            message:
              "The task is not restorable while it or its project is active or archived.",
          });
        }
        if (task.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        const version = expectedVersion + 1;
        const now = new Date();
        const restored = await transaction.orm.public.Task.where({
          id: taskId,
          version: expectedVersion,
        }).updateAndCount({
          archivedAt: null,
          archivedById: null,
          updatedAt: now,
          version,
        });
        if (!restored) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        const assignees = await transaction.orm.public.TaskAssignee.where({
          taskId,
        })
          .orderBy((assignment) => assignment.userId.asc())
          .select("userId")
          .all();
        await transaction.orm.public.Activity.create({
          action: "task.restored",
          actorId,
          createdAt: now,
          details: { version },
          id: randomUUID(),
          projectId: task.projectId,
          taskId,
        });
        return {
          assigneeIds: assignees.map(({ userId }) => userId),
          createdById: task.createdById,
          description: task.description,
          dueDate: task.dueDate,
          id: task.id,
          priority: decodeTaskPriority(task.priority),
          projectId: task.projectId,
          projectTaskNumber: task.projectTaskNumber,
          status: decodeTaskStatus(task.status),
          title: task.title,
          version,
        };
      }),
  });
