import { randomUUID } from "node:crypto";

import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { UndoReceipt } from "./contracts";
import { mapError, uuidSchema } from "./internal";

export const removeComment = (
  actorId: string,
  commentId: string
): Effect.Effect<UndoReceipt, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => {
      if (!Schema.is(uuidSchema)(commentId)) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Choose a valid comment.",
        });
      }
      return db.transaction(async (transaction) => {
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
        const comment = await transaction.orm.public.Comment.include("task")
          .where({ id: commentId })
          .first();
        if (!comment) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The comment was not found.",
          });
        }
        if (comment.deletedAt) {
          throw new AppError({
            code: "CONFLICT",
            message: "The comment is already removed.",
          });
        }
        if (actor.role !== "admin" && comment.authorId !== actorId) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "You can remove only your own comments.",
          });
        }
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 5 * 60_000);
        const undoId = randomUUID();
        await transaction.orm.public.UndoRecord.create({
          action: "comment.remove",
          actorId,
          consumedAt: null,
          createdAt: now,
          entityId: commentId,
          entityType: "comment",
          expiresAt,
          id: undoId,
          snapshot: { deletedById: actorId },
        });
        await transaction.orm.public.Comment.where({ id: commentId }).update({
          deletedAt: now,
          deletedById: actorId,
          updatedAt: now,
        });
        await transaction.orm.public.Activity.create({
          action: "comment.removed",
          actorId,
          createdAt: now,
          details: { commentId },
          id: randomUUID(),
          projectId: comment.task.projectId,
          taskId: comment.taskId,
        });
        return { expiresAt: expiresAt.toISOString(), undoId };
      });
    },
  });
