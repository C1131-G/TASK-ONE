import { not } from "@prisma/orm-postgres/orm-client";
import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { isEmailEventType } from "../email/email-contracts";
import type {
  InboxOptions,
  InboxPage,
  NotificationChannel,
  NotificationPreferenceEvent,
  NotificationPreferenceValue,
} from "./contracts";
import { NotificationPreferencesSchema } from "./contracts";
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
      const [allUnread, inboxUnread] = await Promise.all([
        db.orm.public.Notification.where({ readAt: null, userId }).aggregate(
          (aggregates) => ({ count: aggregates.count() })
        ),
        db.orm.public.Notification.where({ readAt: null, userId })
          .where((notification) => not(notification.type.eq("update")))
          .aggregate((aggregates) => ({ count: aggregates.count() })),
      ]);
      const base = db.orm.public.Notification.include("actor")
        .include("project")
        .where({ userId, ...(options.unreadOnly ? { readAt: null } : {}) });
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
          projectName: notification.project?.name ?? null,
          readAt: notification.readAt?.toISOString() ?? null,
          snippet: notification.snippet,
          taskId: notification.taskId,
          text: notification.text,
          type: notification.type,
        })),
        unreadCount: allUnread.count,
        unreadInboxCount: inboxUnread.count,
      };
    },
  });

export const listPreferences = (
  userId: string
): Effect.Effect<readonly NotificationPreferenceValue[], AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      await verifyUser(userId);
      const preferences = await db.orm.public.NotificationPreference.where({
        userId,
      }).all();
      return Schema.decodeUnknownSync(NotificationPreferencesSchema)(
        preferences.map((preference) => ({
          channel: preference.channel,
          enabled: preference.enabled,
          eventType: preference.eventType,
        }))
      );
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
  channel: NotificationChannel,
  eventType: NotificationPreferenceEvent,
  enabled: boolean
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      await verifyUser(userId);
      if (channel === "email" && !isEmailEventType(eventType)) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Email is not available for that kind of update.",
        });
      }
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
