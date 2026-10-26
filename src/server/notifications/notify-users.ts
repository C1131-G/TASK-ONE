import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";

import type { db } from "@/src/prisma/db";

import { enqueueEmails } from "../email/email-enqueue";
import { queueRealtimeEvents } from "../realtime/publisher";
import type { NotificationTarget } from "./notification-target";
import { resolveTaskTarget } from "./notification-target";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type NotificationEventType =
  | "mention"
  | "assignment"
  | "comment"
  | "update"
  | "due"
  | "client_bug"
  | "status"
  | "sla";

export interface UserNotification {
  readonly actorId: string | null;
  readonly recipientIds: readonly string[];
  readonly type: NotificationEventType;
  readonly text: string;
  readonly snippet: string | null;
  readonly taskId: string | null;
  readonly projectId: string | null;
  // What it is about; a task notification defaults to its task or bug.
  readonly target?: NotificationTarget | null;
  // A local path the notification and its push message open.
  readonly url: string;
  readonly now: Date;
}

// Sends an in-app notification and queues a web push to every active
// recipient except the actor, honouring each person's channel preferences.
export const notifyUsers = async (
  transaction: Transaction,
  notification: UserNotification
): Promise<void> => {
  const recipients = [...new Set(notification.recipientIds)].filter(
    (userId) => userId !== notification.actorId
  );
  if (recipients.length === 0) {
    return;
  }
  const active = await transaction.orm.public.User.where((user) =>
    and(user.id.in(recipients), user.deactivatedAt.isNull())
  )
    .select("id")
    .all();
  const activeIds = active.map(({ id }) => id);
  if (activeIds.length === 0) {
    return;
  }
  const disabled = await transaction.orm.public.NotificationPreference.where(
    (preference) =>
      and(
        preference.userId.in(activeIds),
        preference.eventType.eq(notification.type),
        preference.enabled.eq(false)
      )
  )
    .select("userId", "channel")
    .all();
  const disabledChannels = new Set(
    disabled.map(({ channel, userId }) => `${userId}:${channel}`)
  );
  const target =
    notification.target ??
    (await resolveTaskTarget(transaction, notification.taskId));
  const writes: Promise<unknown>[] = [];
  const issued: { userId: string; notificationId: string }[] = [];
  const issuedInApp: string[] = [];
  for (const userId of activeIds) {
    const notificationId = randomUUID();
    issued.push({ notificationId, userId });
    if (!disabledChannels.has(`${userId}:in-app`)) {
      issuedInApp.push(userId);
      writes.push(
        transaction.orm.public.Notification.create({
          actorId: notification.actorId,
          createdAt: notification.now,
          id: notificationId,
          projectId: notification.projectId,
          readAt: null,
          snippet: notification.snippet,
          targetId: target?.id ?? null,
          targetType: target?.type ?? null,
          taskId: notification.taskId,
          text: notification.text,
          type: notification.type,
          userId,
        })
      );
    }
    if (!disabledChannels.has(`${userId}:web-push`)) {
      writes.push(
        transaction.orm.public.Job.create({
          availableAt: notification.now,
          createdAt: notification.now,
          dedupeKey: `push:${notificationId}`,
          id: randomUUID(),
          kind: "notifications.deliver-push",
          payload: {
            actorId: notification.actorId ?? "system",
            body: notification.snippet ?? "",
            eventType: notification.type,
            notificationId,
            title: notification.text,
            url: notification.url,
            userId,
          },
          updatedAt: notification.now,
        })
      );
    }
  }
  // Held until the surrounding transaction commits, then sent to each
  // recipient's open tabs so the inbox and unread count refresh.
  queueRealtimeEvents(
    issuedInApp.map((userId) => ({ kind: "inbox" as const, userId }))
  );
  writes.push(
    enqueueEmails(transaction, issued, {
      body: notification.snippet ?? "",
      eventType: notification.type,
      now: notification.now,
      title: notification.text,
      url: notification.url,
    })
  );
  await Promise.all(writes);
};

export const activeAdminIds = async (
  transaction: Transaction
): Promise<string[]> => {
  const admins = await transaction.orm.public.User.where((user) =>
    and(user.role.eq("admin"), user.deactivatedAt.isNull())
  )
    .select("id")
    .all();
  return admins.map(({ id }) => id);
};
