import { createHash, randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import { Context, Effect, Layer } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";

export interface NotificationItem {
  readonly id: string;
  readonly type: string;
  readonly text: string;
  readonly snippet: string | null;
  readonly taskId: string | null;
  readonly projectId: string | null;
  readonly actorId: string | null;
  readonly actorName: string | null;
  readonly readAt: string | null;
  readonly createdAt: string;
}

export interface InboxPage {
  readonly items: readonly NotificationItem[];
  readonly unreadCount: number;
}

export interface InboxOptions {
  readonly unreadOnly: boolean;
  readonly limit: number;
}

export class Notifications extends Context.Service<
  Notifications,
  {
    readonly listInbox: (
      userId: string,
      options: InboxOptions
    ) => Effect.Effect<InboxPage, AppError>;
    readonly markRead: (
      userId: string,
      notificationId: string
    ) => Effect.Effect<void, AppError>;
    readonly markAllRead: (userId: string) => Effect.Effect<number, AppError>;
    readonly setPreference: (
      userId: string,
      channel: "in-app" | "web-push",
      eventType: "mention" | "assignment" | "comment" | "update" | "due",
      enabled: boolean
    ) => Effect.Effect<void, AppError>;
    readonly sendDailyDueSummaries: (
      scheduledAt: Date
    ) => Effect.Effect<{ readonly usersNotified: number }, AppError>;
  }
>()("metsys/server/Notifications") {}

const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The notification request could not be completed.",
      });

const verifyUser = async (userId: string): Promise<void> => {
  const user = await db.orm.public.User.where({ id: userId })
    .select("deactivatedAt", "mustChangePassword")
    .first();
  if (!user || user.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (user.mustChangePassword) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Change your password before continuing.",
    });
  }
};

const listInbox = (
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

const markRead = (
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

const markAllRead = (userId: string): Effect.Effect<number, AppError> =>
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

const setPreference = (
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

const stableNotificationId = (userId: string, localDate: string): string => {
  const hex = createHash("sha256")
    .update(`due-summary:${userId}:${localDate}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const getLocalDateAndHour = (
  value: Date,
  timeZone: string
): { readonly date: string; readonly hour: number } => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(value);
  const fields = new Map(
    parts.map(({ type, value: partValue }) => [type, partValue])
  );
  return {
    date: `${fields.get("year")}-${fields.get("month")}-${fields.get("day")}`,
    hour: Number(fields.get("hour")),
  };
};

const timezoneForUser = (value: unknown, fallback: string): string => {
  if (
    typeof value === "object" &&
    value !== null &&
    "timezone" in value &&
    typeof value.timezone === "string"
  ) {
    try {
      const formatter = new Intl.DateTimeFormat("en", {
        timeZone: value.timezone,
      });
      formatter.format(new Date());
      return value.timezone;
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const sendDailyDueSummaries = (
  scheduledAt: Date
): Effect.Effect<{ readonly usersNotified: number }, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => {
      if (!Number.isFinite(scheduledAt.getTime())) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "A valid reminder schedule time is required.",
        });
      }
      return db.transaction(async (transaction) => {
        const [users, preferences, projects, companySettings] =
          await Promise.all([
            transaction.orm.public.User.where({
              deactivatedAt: null,
              mustChangePassword: false,
            })
              .select("id", "name")
              .all(),
            transaction.orm.public.UserPreference.where({ key: "display" })
              .select("userId", "value")
              .all(),
            transaction.orm.public.Project.where({ archivedAt: null })
              .select("id")
              .all(),
            transaction.orm.public.CompanySettings.where({ id: "company" })
              .select("timeZone")
              .first(),
          ]);
        const preferencesByUser = new Map(
          preferences.map(({ userId, value }) => [userId, value])
        );
        const activeProjectIds = new Set(projects.map(({ id }) => id));
        let usersNotified = 0;
        await Promise.all(
          users.map(async (user) => {
            const local = getLocalDateAndHour(
              scheduledAt,
              timezoneForUser(
                preferencesByUser.get(user.id),
                companySettings?.timeZone ?? "Asia/Kolkata"
              )
            );
            if (local.hour !== 9) {
              return;
            }
            const assignments =
              await transaction.orm.public.TaskAssignee.include("task")
                .where({ userId: user.id })
                .all();
            const dueTasks = assignments.flatMap(({ task }) =>
              activeProjectIds.has(task.projectId) &&
              !task.archivedAt &&
              task.status !== "done" &&
              task.dueDate !== null &&
              task.dueDate <= local.date
                ? [task]
                : []
            );
            if (dueTasks.length === 0) {
              return;
            }
            const notificationId = stableNotificationId(user.id, local.date);
            const alreadySent = await transaction.orm.public.Notification.where(
              {
                id: notificationId,
              }
            ).first();
            if (alreadySent) {
              return;
            }
            const now = new Date();
            const title = `You have ${dueTasks.length} due or overdue task${dueTasks.length === 1 ? "" : "s"}`;
            const snippet = dueTasks
              .slice(0, 5)
              .map(({ title: taskTitle }) => taskTitle)
              .join(" · ")
              .slice(0, 240);
            const channelPreferences =
              await transaction.orm.public.NotificationPreference.where(
                (preference) =>
                  and(
                    preference.userId.eq(user.id),
                    preference.eventType.eq("due"),
                    preference.enabled.eq(false)
                  )
              )
                .select("channel")
                .all();
            const disabled = new Set(
              channelPreferences.map(({ channel }) => channel)
            );
            if (!disabled.has("in-app")) {
              await transaction.orm.public.Notification.create({
                actorId: null,
                createdAt: now,
                id: notificationId,
                projectId: null,
                readAt: null,
                snippet,
                taskId: null,
                text: title,
                type: "due",
                userId: user.id,
              });
            }
            if (!disabled.has("web-push")) {
              await transaction.orm.public.Job.upsert({
                conflictOn: { dedupeKey: `push:${notificationId}` },
                create: {
                  availableAt: now,
                  createdAt: now,
                  dedupeKey: `push:${notificationId}`,
                  id: randomUUID(),
                  kind: "notifications.deliver-push",
                  payload: {
                    actorId: "system",
                    body: snippet,
                    eventType: "due",
                    notificationId,
                    title,
                    url: "/tasks",
                    userId: user.id,
                  },
                  updatedAt: now,
                },
                update: { updatedAt: now },
              });
            }
            usersNotified += 1;
          })
        );
        return { usersNotified };
      });
    },
  });

export const NotificationsLive = Layer.succeed(
  Notifications,
  Notifications.of({
    listInbox,
    markAllRead,
    markRead,
    sendDailyDueSummaries,
    setPreference,
  })
);
