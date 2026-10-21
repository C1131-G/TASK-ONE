import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { isUniqueConstraintViolation } from "../core/prisma-errors";
import { EMAIL_CHANNEL, EMAIL_EVENT_TYPES } from "./email-contracts";
import type { EmailEventType } from "./email-contracts";

export const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The email request could not be completed.",
      });

export const emailLinkContext = () => {
  const secret = process.env["BETTER_AUTH_SECRET"];
  if (!secret) {
    throw new AppError({
      code: "UNAVAILABLE",
      message: "Email links cannot be signed on this server.",
    });
  }
  return {
    baseUrl: process.env["BETTER_AUTH_URL"] ?? "http://localhost:3000",
    secret,
  };
};

export interface Recipient {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

/** The person, only while they can sign in and receive workspace mail. */
export const findActiveRecipient = async (
  userId: string
): Promise<Recipient | null> => {
  const user = await db.orm.public.User.where({ id: userId })
    .select("id", "name", "email", "deactivatedAt", "mustChangePassword")
    .first();
  if (!user || user.deactivatedAt || user.mustChangePassword) {
    return null;
  }
  return { email: user.email, id: user.id, name: user.name };
};

/** Events the person has switched on for email; missing rows mean off. */
export const enabledEmailEvents = async (
  userId: string
): Promise<readonly EmailEventType[]> => {
  const rows = await db.orm.public.NotificationPreference.where({
    channel: EMAIL_CHANNEL,
    enabled: true,
    userId,
  })
    .select("eventType")
    .all();
  const enabled = new Set(rows.map(({ eventType }) => eventType));
  return EMAIL_EVENT_TYPES.filter((eventType) => enabled.has(eventType));
};

export const hasDeliveryReceipt = async (dedupeKey: string): Promise<boolean> =>
  (await db.orm.public.EmailDelivery.where({ dedupeKey }).first()) !== null;

// The provider already accepted the mail, so a duplicate-key race with another
// run is the same outcome as writing the receipt ourselves.
export const recordDeliveryReceipt = async (
  userId: string,
  dedupeKey: string
): Promise<void> => {
  try {
    await db.orm.public.EmailDelivery.create({
      dedupeKey,
      id: crypto.randomUUID(),
      sentAt: new Date(),
      userId,
    });
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) {
      throw error;
    }
  }
};

export const digestOptionOf = async (userId: string): Promise<boolean> => {
  const setting = await db.orm.public.EmailSetting.where({ userId }).first();
  return setting?.digest ?? false;
};
