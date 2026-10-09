import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { CommentView } from "./contracts";
import { mapError, uuidSchema } from "./internal";

export const listComments = (
  actorId: string,
  taskId: string
): Effect.Effect<readonly CommentView[], AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      const actor = await db.orm.public.User.where({ id: actorId })
        .select("deactivatedAt", "mustChangePassword")
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
      if (!Schema.is(uuidSchema)(taskId)) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Choose a valid task.",
        });
      }
      const task = await db.orm.public.Task.where({ id: taskId })
        .select("id")
        .first();
      if (!task) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "The task was not found.",
        });
      }
      const records = await db.orm.public.Comment.include("author")
        .where({ deletedAt: null, taskId })
        .orderBy((comment) => comment.createdAt.asc())
        .limit(100)
        .all();
      const commentIds = records.map(({ id }) => id);
      const reactions =
        commentIds.length > 0
          ? await db.orm.public.CommentReaction.where((reaction) =>
              reaction.commentId.in(commentIds)
            ).all()
          : [];
      const groupedByComment = new Map<
        string,
        Map<string, { count: number; reacted: boolean }>
      >();
      for (const reaction of reactions) {
        const grouped = groupedByComment.get(reaction.commentId) ?? new Map();
        const current = grouped.get(reaction.emoji) ?? {
          count: 0,
          reacted: false,
        };
        current.count += 1;
        current.reacted ||= reaction.userId === actorId;
        grouped.set(reaction.emoji, current);
        groupedByComment.set(reaction.commentId, grouped);
      }
      return records.map((record) => {
        const grouped = groupedByComment.get(record.id) ?? new Map();
        return {
          authorId: record.authorId,
          authorName: record.author.name,
          body: record.body,
          createdAt: record.createdAt.toISOString(),
          id: record.id,
          reactions: [...grouped].map(([emoji, summary]) => ({
            count: summary.count,
            emoji,
            reacted: summary.reacted,
          })),
          taskId: record.taskId,
        };
      });
    },
  });
