import { createHash } from "node:crypto";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";

export const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The notification request could not be completed.",
      });

export const verifyUser = async (userId: string): Promise<void> => {
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
export const stableNotificationId = (
  userId: string,
  localDate: string
): string => {
  const hex = createHash("sha256")
    .update(`due-summary:${userId}:${localDate}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const getLocalDateAndHour = (
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

export const timezoneForUser = (value: unknown, fallback: string): string => {
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
