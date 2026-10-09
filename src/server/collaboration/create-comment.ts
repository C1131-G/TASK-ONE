import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { CreatedComment } from "./contracts";
import { mapError, uuidSchema, extractMentionIds } from "./internal";

export const createComment = (
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
