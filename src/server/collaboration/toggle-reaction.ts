import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { mapError, uuidSchema } from "./internal";

export const toggleReaction = (
  actorId: string,
  commentId: string,
  emoji: string
): Effect.Effect<{ readonly active: boolean }, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => {
      const value = emoji.trim();
      const containsControlCharacter = [...value].some((character) => {
        const codePoint = character.codePointAt(0);
        return (
          codePoint !== undefined &&
          (codePoint < 32 || (codePoint >= 127 && codePoint <= 159))
        );
      });
      if (
        !Schema.is(uuidSchema)(commentId) ||
        !value ||
        [...value].length > 8 ||
        containsControlCharacter
      ) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Choose a valid reaction.",
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
          .where({ deletedAt: null, id: commentId })
          .first();
        if (!comment || comment.task.archivedAt) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The active comment was not found.",
          });
        }
        const existing = await transaction.orm.public.CommentReaction.where({
          commentId,
          emoji: value,
          userId: actorId,
        }).delete();
        if (existing) {
          return { active: false };
        }
        await transaction.orm.public.CommentReaction.create({
          commentId,
          createdAt: new Date(),
          emoji: value,
          userId: actorId,
        });
        return { active: true };
      });
    },
  });
