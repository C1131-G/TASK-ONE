import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { CalendarEventInput } from "./calendar-contracts";

export const requireActor = async (
  userId: string,
  adminOnly = false
): Promise<void> => {
  const actor = await db.orm.public.User.where({ id: userId })
    .select("role", "deactivatedAt", "mustChangePassword")
    .first();
  if (!actor || actor.deactivatedAt || actor.mustChangePassword) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in required.",
    });
  }
  if (adminOnly && actor.role !== "admin") {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Only administrators can manage calendar events.",
    });
  }
};

export const validateEvent = (input: CalendarEventInput): void => {
  if (!input.title.trim() || input.title.length > 200) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Invalid event title.",
    });
  }
  if (
    !Number.isFinite(input.startsAt.getTime()) ||
    (input.endsAt &&
      (!Number.isFinite(input.endsAt.getTime()) ||
        input.endsAt < input.startsAt))
  ) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Invalid event date range.",
    });
  }
  if (input.description && input.description.length > 10_000) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Event description is too long.",
    });
  }
  if (input.location && input.location.length > 300) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Invalid location.",
    });
  }
  if (
    input.attendeeIds.length > 100 ||
    new Set(input.attendeeIds).size !== input.attendeeIds.length
  ) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Invalid event attendees.",
    });
  }
};
export const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The calendar request could not be completed.",
      });
