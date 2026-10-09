import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";

import type { Transaction } from "./work-internal";

export const notifyTaskAssignees = async (
  transaction: Transaction,
  actor: { readonly id: string; readonly name: string },
  task: {
    readonly id: string;
    readonly projectId: string;
    readonly title: string;
  },
  assigneeIds: readonly string[],
  now: Date,
  eventType: "assignment" | "update" = "assignment"
): Promise<void> => {
  const recipients = [...new Set(assigneeIds)].filter(
    (userId) => userId !== actor.id
  );
  if (recipients.length === 0) {
    return;
  }
  const activeRecipients = await transaction.orm.public.User.where((user) =>
    and(user.id.in(recipients), user.deactivatedAt.isNull())
  )
    .select("id")
    .all();
  const activeRecipientIds = activeRecipients.map(({ id }) => id);
  if (activeRecipientIds.length === 0) {
    return;
  }
  const disabled = await transaction.orm.public.NotificationPreference.where(
    (preference) =>
      and(
        preference.userId.in(activeRecipientIds),
        preference.eventType.eq(eventType),
        preference.enabled.eq(false)
      )
  )
    .select("userId", "channel")
    .all();
  const disabledChannels = new Set(
    disabled.map(({ channel, userId }) => `${userId}:${channel}`)
  );
  const writes: Promise<unknown>[] = [];
  for (const userId of activeRecipientIds) {
    const notificationId = randomUUID();
    const text =
      eventType === "assignment"
        ? `${actor.name} assigned you a task`
        : `${actor.name} updated a task`;
    if (!disabledChannels.has(`${userId}:in-app`)) {
      writes.push(
        transaction.orm.public.Notification.create({
          actorId: actor.id,
          createdAt: now,
          id: notificationId,
          projectId: task.projectId,
          readAt: null,
          snippet: task.title,
          taskId: task.id,
          text,
          type: eventType,
          userId,
        })
      );
    }
    if (!disabledChannels.has(`${userId}:web-push`)) {
      writes.push(
        transaction.orm.public.Job.create({
          availableAt: now,
          createdAt: now,
          dedupeKey: `push:${notificationId}`,
          id: randomUUID(),
          kind: "notifications.deliver-push",
          payload: {
            actorId: actor.id,
            body: task.title,
            eventType,
            notificationId,
            title: text,
            url: `/tasks/${task.id}`,
            userId,
          },
          updatedAt: now,
        })
      );
    }
  }
  await Promise.all(writes);
};
