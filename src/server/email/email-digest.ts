import { and } from "@prisma/orm-postgres/orm-client";
import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import {
  getLocalDateAndHour,
  timezoneForUser,
} from "../notifications/service-internal";
import type { EmailNotifications } from "./email-contracts";
import {
  emailLinkContext,
  enabledEmailEvents,
  findActiveRecipient,
  hasDeliveryReceipt,
  mapError,
  recordDeliveryReceipt,
} from "./email-internal";
import { renderDigestEmail } from "./email-template";
import type { DigestItem } from "./email-template";
import type { MailTransportApi } from "./mail-transport";

const DIGEST_LOCAL_HOUR = 8;
const FIRST_DIGEST_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const MAX_DIGEST_ITEMS = 50;
const DEFAULT_TIME_ZONE = "Asia/Kolkata";

interface DigestSetting {
  readonly userId: string;
  readonly lastDigestAt: Date | null;
}

const linkFor = (row: {
  readonly taskId: string | null;
  readonly projectId: string | null;
}): string => {
  if (row.taskId) {
    return `/tasks/${row.taskId}`;
  }
  return row.projectId ? `/projects/${row.projectId}` : "/notifications";
};

const digestItemsFor = async (
  userId: string,
  since: Date,
  until: Date
): Promise<readonly DigestItem[]> => {
  const events = await enabledEmailEvents(userId);
  if (events.length === 0) {
    return [];
  }
  const rows = await db.orm.public.Notification.where((notification) =>
    and(
      notification.userId.eq(userId),
      notification.createdAt.gt(since),
      notification.createdAt.lte(until),
      notification.type.in([...events])
    )
  )
    .orderBy((notification) => notification.createdAt.asc())
    .limit(MAX_DIGEST_ITEMS)
    .all();
  return rows.map((row) => ({
    body: row.snippet ?? "",
    title: row.text,
    url: linkFor(row),
  }));
};

// Sends the digest for one person when it is their local morning and there is
// news. Returns whether a mail left the server.
const digestOne = async (
  transport: MailTransportApi,
  setting: DigestSetting,
  scheduledAt: Date,
  companyTimeZone: string
): Promise<boolean> => {
  const [recipient, display] = await Promise.all([
    findActiveRecipient(setting.userId),
    db.orm.public.UserPreference.where({
      key: "display",
      userId: setting.userId,
    })
      .select("value")
      .first(),
  ]);
  if (!recipient) {
    return false;
  }
  const local = getLocalDateAndHour(
    scheduledAt,
    timezoneForUser(display?.value, companyTimeZone)
  );
  const dedupeKey = `digest:${recipient.id}:${local.date}`;
  if (
    local.hour !== DIGEST_LOCAL_HOUR ||
    (await hasDeliveryReceipt(dedupeKey))
  ) {
    return false;
  }
  const since =
    setting.lastDigestAt ??
    new Date(scheduledAt.getTime() - FIRST_DIGEST_LOOKBACK_MS);
  const items = await digestItemsFor(recipient.id, since, scheduledAt);
  if (items.length === 0) {
    return false;
  }
  const email = renderDigestEmail({
    ...emailLinkContext(),
    items,
    recipientName: recipient.name,
    userId: recipient.id,
  });
  const outcome = await Effect.runPromise(
    transport.send({ ...email, to: recipient.email })
  );
  if (outcome !== "sent") {
    return false;
  }
  await recordDeliveryReceipt(recipient.id, dedupeKey);
  await db.orm.public.EmailSetting.where({ userId: recipient.id }).update({
    lastDigestAt: scheduledAt,
    updatedAt: new Date(),
  });
  return true;
};

export const makeSendDigests =
  (transport: MailTransportApi): EmailNotifications["Service"]["sendDigests"] =>
  (scheduledAt) =>
    Effect.tryPromise({
      catch: mapError,
      try: async () => {
        const [settings, company] = await Promise.all([
          db.orm.public.EmailSetting.where({ digest: true })
            .select("userId", "lastDigestAt")
            .all(),
          db.orm.public.CompanySettings.where({ id: "company" })
            .select("timeZone")
            .first(),
        ]);
        let usersEmailed = 0;
        for (const setting of settings) {
          // One person at a time keeps provider load flat; a provider failure
          // fails the job so the whole digest run retries (receipts dedupe).
          // eslint-disable-next-line no-await-in-loop
          const sent = await digestOne(
            transport,
            setting,
            scheduledAt,
            company?.timeZone ?? DEFAULT_TIME_ZONE
          );
          usersEmailed += sent ? 1 : 0;
        }
        return { usersEmailed };
      },
    });
