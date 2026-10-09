import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { InboxOptions, InboxPage } from "./contracts";
import { mapError, verifyUser } from "./service-internal";

export const listInbox = (
  userId: string,
  options: InboxOptions
): Effect.Effect<InboxPage, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      await verifyUser(userId);
      const limit = Math.max(1, Math.min(100, Math.trunc(options.limit)));
      const allUnread = await db.orm.public.Notification.where({
        readAt: null,
        userId,
      })
        .select("id")
        .all();
      const base = db.orm.public.Notification.include("actor").where({
        userId,
        ...(options.unreadOnly ? { readAt: null } : {}),
      });
      const notifications = await base
        .orderBy((notification) => notification.createdAt.desc())
        .limit(limit)
        .all();
      return {
        items: notifications.map((notification) => ({
          actorId: notification.actorId,
          actorName: notification.actor?.name ?? null,
          createdAt: notification.createdAt.toISOString(),
          id: notification.id,
          projectId: notification.projectId,
          readAt: notification.readAt?.toISOString() ?? null,
          snippet: notification.snippet,
          taskId: notification.taskId,
          text: notification.text,
          type: notification.type,
        })),
        unreadCount: allUnread.length,
      };
    },
  });

export const markRead = (
  userId: string,
  notificationId: string
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      await verifyUser(userId);
      const notification = await db.orm.public.Notification.where({
        id: notificationId,
        userId,
      }).first();
      if (!notification) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "The notification was not found.",
        });
      }
      if (!notification.readAt) {
        await db.orm.public.Notification.where({
          id: notificationId,
          userId,
        }).update({ readAt: new Date() });
      }
    },
  });

export const markAllRead = (userId: string): Effect.Effect<number, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      await verifyUser(userId);
      return db.transaction(async (transaction) => {
        const pending = await transaction.orm.public.Notification.where({
          readAt: null,
          userId,
        })
          .select("id")
          .all();
        if (pending.length > 0) {
          await transaction.orm.public.Notification.where({
            readAt: null,
            userId,
          }).updateAll({ readAt: new Date() });
        }
        return pending.length;
      });
    },
  });

export const setPreference = (
  userId: string,
  channel: "in-app" | "web-push",
  eventType: "mention" | "assignment" | "comment" | "update" | "due",
  enabled: boolean
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      await verifyUser(userId);
      await db.orm.public.NotificationPreference.upsert({
        conflictOn: { channel, eventType, userId },
        create: {
          channel,
          enabled,
          eventType,
          id: crypto.randomUUID(),
          updatedAt: new Date(),
          userId,
        },
        update: { enabled, updatedAt: new Date() },
      });
    },
  });
