import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { TaskArchiveUndoReceipt } from "./work-contracts";
import { databaseError } from "./work-internal";
import { requireTaskAdmin } from "./work-task-admin";

export const archiveTask = (
  actorId: string,
  taskId: string,
  expectedVersion: number
): Effect.Effect<TaskArchiveUndoReceipt, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => {
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "A valid task version is required.",
        });
      }
      return db.transaction(async (transaction) => {
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
        if (task.archivedAt || task.project.archivedAt) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task or its project is already archived.",
          });
        }
        if (task.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        const now = new Date();
        const version = expectedVersion + 1;
        const updated = await transaction.orm.public.Task.where({
          id: taskId,
          version: expectedVersion,
        }).updateAndCount({
          archivedAt: now,
          archivedById: actorId,
          updatedAt: now,
          version,
        });
        if (!updated) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        const undoId = randomUUID();
        const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
        await transaction.orm.public.UndoRecord.create({
          action: "task.archive",
          actorId,
          consumedAt: null,
          createdAt: now,
          entityId: taskId,
          entityType: "task",
          expiresAt,
          id: undoId,
          snapshot: { version },
        });
        await transaction.orm.public.Activity.create({
          action: "task.archived",
          actorId,
          createdAt: now,
          details: { version },
          id: randomUUID(),
          projectId: task.projectId,
          taskId,
        });
        return { expiresAt: expiresAt.toISOString(), undoId };
      });
    },
  });
export const undoTaskArchive = (
  actorId: string,
  undoId: string
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () =>
      db.transaction(async (transaction) => {
        await requireTaskAdmin(transaction, actorId);
        const undo = await transaction.orm.public.UndoRecord.where({
          id: undoId,
        }).first();
        if (!undo) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The undo request was not found.",
          });
        }
        if (undo.actorId !== actorId) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "This undo request belongs to another user.",
          });
        }
        if (undo.action !== "task.archive" || undo.entityType !== "task") {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The undo request was not found.",
          });
        }
        if (undo.consumedAt || undo.expiresAt <= new Date()) {
          throw new AppError({
            code: "CONFLICT",
            message: "This undo request has expired or was already used.",
          });
        }
        const archivedVersion =
          typeof undo.snapshot === "object" &&
          undo.snapshot !== null &&
          "version" in undo.snapshot &&
          typeof undo.snapshot.version === "number"
            ? undo.snapshot.version
            : null;
        if (!archivedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The undo request no longer matches the task.",
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
        if (
          !task.archivedAt ||
          task.archivedById !== actorId ||
          task.version !== archivedVersion
        ) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed after it was archived.",
          });
        }
        const now = new Date();
        const restored = await transaction.orm.public.Task.where({
          archivedById: actorId,
          id: task.id,
          version: archivedVersion,
        }).updateAndCount({
          archivedAt: null,
          archivedById: null,
          updatedAt: now,
          version: archivedVersion + 1,
        });
        if (!restored) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed after it was archived.",
          });
        }
        const consumed = await transaction.orm.public.UndoRecord.where({
          consumedAt: null,
          id: undoId,
        }).updateAndCount({ consumedAt: now });
        if (!consumed) {
          throw new AppError({
            code: "CONFLICT",
            message: "This undo request has expired or was already used.",
          });
        }
        await transaction.orm.public.Activity.create({
          action: "task.archive_undone",
          actorId,
          createdAt: now,
          details: { undoId },
          id: randomUUID(),
          projectId: task.projectId,
          taskId: task.id,
        });
      }),
  });
