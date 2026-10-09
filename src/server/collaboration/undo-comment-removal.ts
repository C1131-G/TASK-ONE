import { randomUUID } from "node:crypto";

import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { mapError, uuidSchema } from "./internal";

export const undoCommentRemoval = (
  actorId: string,
  undoId: string
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      if (!Schema.is(uuidSchema)(undoId)) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Choose a valid undo request.",
        });
      }
      await db.transaction(async (transaction) => {
        const actor = await transaction.orm.public.User.where({ id: actorId })
          .select("role", "name", "mustChangePassword", "deactivatedAt")
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
        const undo = await transaction.orm.public.UndoRecord.where({
          id: undoId,
        }).first();
        if (
          !undo ||
          undo.action !== "comment.remove" ||
          undo.entityType !== "comment"
        ) {
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
        if (undo.consumedAt || undo.expiresAt <= new Date()) {
          throw new AppError({
            code: "CONFLICT",
            message: "This undo request has expired or was already used.",
          });
        }
        const comment = await transaction.orm.public.Comment.include("task")
          .where({ id: undo.entityId })
          .first();
        if (!comment || !comment.deletedAt || comment.deletedById !== actorId) {
          throw new AppError({
            code: "CONFLICT",
            message: "The comment changed after it was removed.",
          });
        }
        const now = new Date();
        await transaction.orm.public.Comment.where({ id: comment.id }).update({
          deletedAt: null,
          deletedById: null,
          updatedAt: now,
        });
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
          action: "comment.removal_undone",
          actorId,
          createdAt: now,
          details: { commentId: comment.id, undoId },
          id: randomUUID(),
          projectId: comment.task.projectId,
          taskId: comment.taskId,
        });
      });
    },
  });
