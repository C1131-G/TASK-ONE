import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";

import type { db } from "@/src/prisma/db";

import {
  EMAIL_CHANNEL,
  EMAIL_DELIVERY_JOB,
  isEmailEventType,
} from "./email-contracts";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface EmailNotice {
  readonly eventType: string;
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly now: Date;
}

// Records one email job per person who switched this event on for email. A
// person on the daily digest gets the job already completed: nothing sends it,
// and the digest reads these rows (see email-digest.ts) so events they turned
// off in-app still reach it. Everyone else's job re-checks preferences when it
// runs, so this only avoids queueing work nobody asked for.
export const enqueueEmails = async (
  transaction: Transaction,
  recipients: readonly {
    readonly userId: string;
    readonly notificationId: string;
  }[],
  notice: EmailNotice
): Promise<void> => {
  const userIds = recipients.map(({ userId }) => userId);
  if (!isEmailEventType(notice.eventType) || userIds.length === 0) {
    return;
  }
  const notificationIds = new Map(
    recipients.map(({ notificationId, userId }) => [userId, notificationId])
  );
  const [enabled, digests] = await Promise.all([
    transaction.orm.public.NotificationPreference.where((preference) =>
      and(
        preference.userId.in([...userIds]),
        preference.channel.eq(EMAIL_CHANNEL),
        preference.eventType.eq(notice.eventType),
        preference.enabled.eq(true)
      )
    )
      .select("userId")
      .all(),
    transaction.orm.public.EmailSetting.where((setting) =>
      and(setting.userId.in([...userIds]), setting.digest.eq(true))
    )
      .select("userId")
      .all(),
  ]);
  const digestUsers = new Set(digests.map(({ userId }) => userId));
  await Promise.all(
    enabled.flatMap(({ userId }) => {
      const notificationId = notificationIds.get(userId) ?? randomUUID();
      return [
        transaction.orm.public.Job.create({
          availableAt: notice.now,
          completedAt: digestUsers.has(userId) ? notice.now : null,
          createdAt: notice.now,
          dedupeKey: `email:${notificationId}`,
          id: randomUUID(),
          kind: EMAIL_DELIVERY_JOB,
          payload: {
            body: notice.body,
            eventType: notice.eventType,
            notificationId,
            title: notice.title,
            url: notice.url,
            userId,
          },
          updatedAt: notice.now,
        }),
      ];
    })
  );
};
