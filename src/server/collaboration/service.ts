import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";

export interface CreatedComment {
  readonly id: string;
  readonly taskId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface CommentView extends CreatedComment {
  readonly authorName: string;
  readonly reactions: readonly {
    readonly emoji: string;
    readonly count: number;
    readonly reacted: boolean;
  }[];
}

export interface UndoReceipt {
  readonly expiresAt: string;
  readonly undoId: string;
}

export const CreatedCommentSchema = Schema.Struct({
  authorId: Schema.String,
  body: Schema.String,
  createdAt: Schema.String,
  id: Schema.String,
  taskId: Schema.String,
});

export const CommentViewSchema = Schema.Struct({
  ...CreatedCommentSchema.fields,
  authorName: Schema.String,
  reactions: Schema.Array(
    Schema.Struct({
      count: Schema.Number,
      emoji: Schema.String,
      reacted: Schema.Boolean,
    })
  ),
});
export const CommentListSchema = Schema.Array(CommentViewSchema);

export const UndoReceiptSchema = Schema.Struct({
  expiresAt: Schema.String,
  undoId: Schema.String,
});

export const CommentReactionResultSchema = Schema.Struct({
  active: Schema.Boolean,
});

export const CommentUndoneResultSchema = Schema.Struct({
  undone: Schema.Literal(true),
});

export class Collaboration extends Context.Service<
  Collaboration,
  {
    readonly listComments: (
      actorId: string,
      taskId: string
    ) => Effect.Effect<readonly CommentView[], AppError>;
    readonly createComment: (
      actorId: string,
      taskId: string,
      body: string
    ) => Effect.Effect<CreatedComment, AppError>;
    readonly removeComment: (
      actorId: string,
      commentId: string
    ) => Effect.Effect<UndoReceipt, AppError>;
    readonly undoCommentRemoval: (
      actorId: string,
      undoId: string
    ) => Effect.Effect<void, AppError>;
    readonly toggleReaction: (
      actorId: string,
      commentId: string,
      emoji: string
    ) => Effect.Effect<{ readonly active: boolean }, AppError>;
  }
>()("metsys/server/Collaboration") {}

const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The collaboration request could not be completed.",
      });

const uuidSchema = Schema.String.check(Schema.isUUID());

const listComments = (
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

const extractMentionIds = (body: string): readonly string[] => {
  const mentions = new Set<string>();
  let searchFrom = 0;
  while (searchFrom < body.length) {
    const tokenStart = body.indexOf("@[", searchFrom);
    if (tokenStart === -1) {
      break;
    }
    const tokenEnd = body.indexOf("]", tokenStart + 2);
    if (tokenEnd === -1) {
      break;
    }
    const candidate = body.slice(tokenStart + 2, tokenEnd);
    if (Schema.is(uuidSchema)(candidate)) {
      mentions.add(candidate);
    }
    searchFrom = tokenEnd + 1;
  }
  return [...mentions];
};

const createComment = (
  actorId: string,
  taskId: string,
  rawBody: string
): Effect.Effect<CreatedComment, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => {
      const body = rawBody.trim();
      if (!Schema.is(uuidSchema)(taskId) || !body || body.length > 10_000) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Comments must contain 1 to 10,000 characters.",
        });
      }
      const mentionIds = extractMentionIds(body);
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
        const task = await transaction.orm.public.Task.where({
          archivedAt: null,
          id: taskId,
        })
          .select("createdById", "id", "projectId")
          .first();
        if (!task) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The active task was not found.",
          });
        }
        if (mentionIds.length > 0) {
          const mentioned = await transaction.orm.public.User.where((user) =>
            and(user.id.in([...mentionIds]), user.deactivatedAt.isNull())
          )
            .select("id")
            .all();
          if (mentioned.length !== mentionIds.length) {
            throw new AppError({
              code: "VALIDATION_FAILED",
              message: "A mentioned employee is not active.",
            });
          }
        }

        const id = randomUUID();
        const createdAt = new Date();
        await transaction.orm.public.Comment.create({
          authorId: actorId,
          body,
          createdAt,
          deletedAt: null,
          deletedById: null,
          id,
          taskId,
          updatedAt: createdAt,
        });
        await transaction.orm.public.Activity.create({
          action: "comment.created",
          actorId,
          createdAt,
          details: { commentId: id },
          id: randomUUID(),
          projectId: task.projectId,
          taskId,
        });
        const recipients = mentionIds.filter(
          (mentionId) => mentionId !== actorId
        );
        if (recipients.length > 0) {
          const [users, preferences] = await Promise.all([
            transaction.orm.public.User.where((user) =>
              and(user.id.in(recipients), user.deactivatedAt.isNull())
            )
              .select("id")
              .all(),
            transaction.orm.public.NotificationPreference.where((preference) =>
              and(
                preference.userId.in(recipients),
                preference.eventType.eq("mention"),
                preference.enabled.eq(false)
              )
            )
              .select("userId", "channel")
              .all(),
          ]);
          const disabledChannels = new Set(
            preferences.map(({ userId, channel }) => `${userId}:${channel}`)
          );
          const notificationWrites: Promise<unknown>[] = [];
          for (const user of users) {
            const notificationId = randomUUID();
            if (!disabledChannels.has(`${user.id}:in-app`)) {
              notificationWrites.push(
                transaction.orm.public.Notification.create({
                  actorId,
                  createdAt,
                  id: notificationId,
                  projectId: task.projectId,
                  readAt: null,
                  snippet: body.slice(0, 240),
                  taskId,
                  text: `${actor.name} mentioned you`,
                  type: "mention",
                  userId: user.id,
                })
              );
            }
            if (!disabledChannels.has(`${user.id}:web-push`)) {
              const jobId = randomUUID();
              notificationWrites.push(
                transaction.orm.public.Job.create({
                  availableAt: createdAt,
                  createdAt,
                  dedupeKey: `push:${notificationId}`,
                  id: jobId,
                  kind: "notifications.deliver-push",
                  payload: {
                    actorId,
                    body: body.slice(0, 240),
                    eventType: "mention",
                    notificationId,
                    title: `${actor.name} mentioned you`,
                    url: `/tasks/${taskId}`,
                    userId: user.id,
                  },
                  updatedAt: createdAt,
                })
              );
            }
          }
          await Promise.all(notificationWrites);
        }
        const assignmentRows = await transaction.orm.public.TaskAssignee.where({
          taskId,
        })
          .select("userId")
          .all();
        const mentionedIds = new Set(mentionIds);
        const commentRecipientIds = [
          ...new Set([
            task.createdById,
            ...assignmentRows.map(({ userId }) => userId),
          ]),
        ].filter((userId) => userId !== actorId && !mentionedIds.has(userId));
        if (commentRecipientIds.length > 0) {
          const [users, preferences] = await Promise.all([
            transaction.orm.public.User.where((user) =>
              and(user.id.in(commentRecipientIds), user.deactivatedAt.isNull())
            )
              .select("id")
              .all(),
            transaction.orm.public.NotificationPreference.where((preference) =>
              and(
                preference.userId.in(commentRecipientIds),
                preference.eventType.eq("comment"),
                preference.enabled.eq(false)
              )
            )
              .select("userId", "channel")
              .all(),
          ]);
          const disabledChannels = new Set(
            preferences.map(({ channel, userId }) => `${userId}:${channel}`)
          );
          const notificationWrites: Promise<unknown>[] = [];
          for (const user of users) {
            const notificationId = randomUUID();
            const title = `${actor.name} commented on a task`;
            if (!disabledChannels.has(`${user.id}:in-app`)) {
              notificationWrites.push(
                transaction.orm.public.Notification.create({
                  actorId,
                  createdAt,
                  id: notificationId,
                  projectId: task.projectId,
                  readAt: null,
                  snippet: body.slice(0, 240),
                  taskId,
                  text: title,
                  type: "comment",
                  userId: user.id,
                })
              );
            }
            if (!disabledChannels.has(`${user.id}:web-push`)) {
              notificationWrites.push(
                transaction.orm.public.Job.create({
                  availableAt: createdAt,
                  createdAt,
                  dedupeKey: `push:${notificationId}`,
                  id: randomUUID(),
                  kind: "notifications.deliver-push",
                  payload: {
                    actorId,
                    body: body.slice(0, 240),
                    eventType: "comment",
                    notificationId,
                    title,
                    url: `/tasks/${taskId}`,
                    userId: user.id,
                  },
                  updatedAt: createdAt,
                })
              );
            }
          }
          await Promise.all(notificationWrites);
        }
        return {
          authorId: actorId,
          body,
          createdAt: createdAt.toISOString(),
          id,
          taskId,
        };
      });
    },
  });

const removeComment = (
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

const undoCommentRemoval = (
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

const toggleReaction = (
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

export const CollaborationLive = Layer.succeed(
  Collaboration,
  Collaboration.of({
    createComment,
    listComments,
    removeComment,
    toggleReaction,
    undoCommentRemoval,
  })
);
