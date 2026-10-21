import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { EMAIL_CHANNEL } from "./email-contracts";
import type { EmailNotifications } from "./email-contracts";
import { digestOptionOf, mapError } from "./email-internal";

export const getSettings: EmailNotifications["Service"]["getSettings"] = (
  userId
) =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => ({ digest: await digestOptionOf(userId) }),
  });

export const setDigest: EmailNotifications["Service"]["setDigest"] = (
  userId,
  digest
) =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      const now = new Date();
      await db.orm.public.EmailSetting.upsert({
        conflictOn: { userId },
        create: { digest, updatedAt: now, userId },
        update: { digest, updatedAt: now },
      });
    },
  });

// Email is opt-in, so removing the person's email rows turns every event off.
export const unsubscribe: EmailNotifications["Service"]["unsubscribe"] = (
  userId
) =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      await db.orm.public.NotificationPreference.where({
        channel: EMAIL_CHANNEL,
        userId,
      }).deleteAll();
      await db.orm.public.EmailSetting.where({ userId }).updateAll({
        digest: false,
        updatedAt: new Date(),
      });
    },
  });
