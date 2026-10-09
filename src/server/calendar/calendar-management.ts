import { randomUUID } from "node:crypto";

import { and, or } from "@prisma/orm-postgres/orm-client";
import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";

export interface CalendarEventInput {
  readonly attendeeIds: readonly string[];
  readonly description: string | null;
  readonly endsAt: Date | null;
  readonly location: string | null;
  readonly projectId: string | null;
  readonly startsAt: Date;
  readonly title: string;
}

export interface CalendarEventSummary extends CalendarEventInput {
  readonly id: string;
  readonly createdById: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const CalendarEventSummarySchema = Schema.Struct({
  attendeeIds: Schema.Array(Schema.String),
  createdAt: Schema.String,
  createdById: Schema.String,
  description: Schema.NullOr(Schema.String),
  endsAt: Schema.NullOr(Schema.DateFromString),
  id: Schema.String,
  location: Schema.NullOr(Schema.String),
  projectId: Schema.NullOr(Schema.String),
  startsAt: Schema.DateFromString,
  title: Schema.String,
  updatedAt: Schema.String,
});
export const CalendarEventListSchema = Schema.Array(CalendarEventSummarySchema);

const requireActor = async (
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

const validateEvent = (input: CalendarEventInput): void => {
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

const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The calendar request could not be completed.",
      });

export class CalendarManagement extends Context.Service<
  CalendarManagement,
  {
    readonly listEvents: (
      userId: string,
      from: Date,
      to: Date
    ) => Effect.Effect<readonly CalendarEventSummary[], AppError>;
    readonly createEvent: (
      userId: string,
      input: CalendarEventInput
    ) => Effect.Effect<CalendarEventSummary, AppError>;
    readonly updateEvent: (
      userId: string,
      eventId: string,
      input: CalendarEventInput
    ) => Effect.Effect<CalendarEventSummary, AppError>;
    readonly deleteEvent: (
      userId: string,
      eventId: string
    ) => Effect.Effect<void, AppError>;
  }
>()("metsys/server/CalendarManagement") {}

export const CalendarManagementLive = Layer.succeed(CalendarManagement, {
  createEvent: (userId, input) =>
    Effect.tryPromise({
      catch: mapError,
      try: async () => {
        validateEvent(input);
        await requireActor(userId, true);
        return db.transaction(async (transaction) => {
          if (input.projectId) {
            const project = await transaction.orm.public.Project.where({
              archivedAt: null,
              id: input.projectId,
            })
              .select("id")
              .first();
            if (!project) {
              throw new AppError({
                code: "NOT_FOUND",
                message: "The project was not found.",
              });
            }
          }
          if (input.attendeeIds.length > 0) {
            const activeAttendees = await transaction.orm.public.User.where(
              (user) =>
                and(
                  user.id.in([...input.attendeeIds]),
                  user.deactivatedAt.isNull(),
                  user.mustChangePassword.eq(false)
                )
            )
              .select("id")
              .all();
            if (activeAttendees.length !== input.attendeeIds.length) {
              throw new AppError({
                code: "VALIDATION_FAILED",
                message: "One or more attendees are unavailable.",
              });
            }
          }
          const event = await transaction.orm.public.CalendarEvent.create({
            createdAt: new Date(),
            createdById: userId,
            description: input.description,
            endsAt: input.endsAt,
            id: randomUUID(),
            location: input.location,
            projectId: input.projectId,
            startsAt: input.startsAt,
            title: input.title.trim(),
            updatedAt: new Date(),
          });
          await Promise.all(
            input.attendeeIds.map((attendeeId) =>
              transaction.orm.public.CalendarEventAttendee.create({
                createdAt: new Date(),
                eventId: event.id,
                userId: attendeeId,
              })
            )
          );
          return {
            attendeeIds: [...input.attendeeIds],
            createdAt: event.createdAt.toISOString(),
            createdById: event.createdById,
            description: event.description,
            endsAt: event.endsAt,
            id: event.id,
            location: event.location,
            projectId: event.projectId,
            startsAt: event.startsAt,
            title: event.title,
            updatedAt: event.updatedAt.toISOString(),
          };
        });
      },
    }),
  deleteEvent: (userId, eventId) =>
    Effect.tryPromise({
      catch: mapError,
      try: async () => {
        await requireActor(userId, true);
        await db.transaction(async (transaction) => {
          const deleted = await transaction.orm.public.CalendarEvent.where({
            id: eventId,
          }).delete();
          if (!deleted) {
            throw new AppError({
              code: "NOT_FOUND",
              message: "The calendar event was not found.",
            });
          }
        });
      },
    }),
  listEvents: (userId, from, to) =>
    Effect.tryPromise({
      catch: mapError,
      try: async () => {
        if (
          !Number.isFinite(from.getTime()) ||
          !Number.isFinite(to.getTime()) ||
          to <= from ||
          to.getTime() - from.getTime() > 93 * 86_400_000
        ) {
          throw new AppError({
            code: "VALIDATION_FAILED",
            message: "Choose a calendar range of 93 days or less.",
          });
        }
        await requireActor(userId);
        const events = await db.orm.public.CalendarEvent.where((event) =>
          and(
            event.startsAt.lt(to),
            or(event.endsAt.isNull(), event.endsAt.gte(from))
          )
        )
          .orderBy((event) => event.startsAt.asc())
          .all();
        const attendeeRows =
          events.length === 0
            ? []
            : await db.orm.public.CalendarEventAttendee.where((attendee) =>
                attendee.eventId.in(events.map(({ id }) => id))
              )
                .select("eventId", "userId")
                .all();
        const attendeesByEvent = new Map<string, string[]>();
        for (const attendee of attendeeRows) {
          const ids = attendeesByEvent.get(attendee.eventId) ?? [];
          ids.push(attendee.userId);
          attendeesByEvent.set(attendee.eventId, ids);
        }
        return events.map((event) => ({
          attendeeIds: attendeesByEvent.get(event.id) ?? [],
          createdAt: event.createdAt.toISOString(),
          createdById: event.createdById,
          description: event.description,
          endsAt: event.endsAt,
          id: event.id,
          location: event.location,
          projectId: event.projectId,
          startsAt: event.startsAt,
          title: event.title,
          updatedAt: event.updatedAt.toISOString(),
        }));
      },
    }),
  updateEvent: (userId, eventId, input) =>
    Effect.tryPromise({
      catch: mapError,
      try: async () => {
        validateEvent(input);
        await requireActor(userId, true);
        return db.transaction(async (transaction) => {
          const existing = await transaction.orm.public.CalendarEvent.where({
            id: eventId,
          }).first();
          if (!existing) {
            throw new AppError({
              code: "NOT_FOUND",
              message: "The calendar event was not found.",
            });
          }
          if (input.projectId) {
            const project = await transaction.orm.public.Project.where({
              archivedAt: null,
              id: input.projectId,
            })
              .select("id")
              .first();
            if (!project) {
              throw new AppError({
                code: "NOT_FOUND",
                message: "The project was not found.",
              });
            }
          }
          if (input.attendeeIds.length > 0) {
            const attendees = await transaction.orm.public.User.where((user) =>
              and(
                user.id.in([...input.attendeeIds]),
                user.deactivatedAt.isNull(),
                user.mustChangePassword.eq(false)
              )
            )
              .select("id")
              .all();
            if (attendees.length !== input.attendeeIds.length) {
              throw new AppError({
                code: "VALIDATION_FAILED",
                message: "One or more attendees are unavailable.",
              });
            }
          }
          const now = new Date();
          const updated = await transaction.orm.public.CalendarEvent.where({
            id: eventId,
          }).update({
            description: input.description,
            endsAt: input.endsAt,
            location: input.location,
            projectId: input.projectId,
            startsAt: input.startsAt,
            title: input.title.trim(),
            updatedAt: now,
          });
          if (!updated) {
            throw new AppError({
              code: "NOT_FOUND",
              message: "The calendar event was not found.",
            });
          }
          await transaction.orm.public.CalendarEventAttendee.where({
            eventId,
          }).deleteAll();
          await Promise.all(
            input.attendeeIds.map((attendeeId) =>
              transaction.orm.public.CalendarEventAttendee.create({
                createdAt: now,
                eventId,
                userId: attendeeId,
              })
            )
          );
          return {
            attendeeIds: [...input.attendeeIds],
            createdAt: updated.createdAt.toISOString(),
            createdById: updated.createdById,
            description: updated.description,
            endsAt: updated.endsAt,
            id: updated.id,
            location: updated.location,
            projectId: updated.projectId,
            startsAt: updated.startsAt,
            title: updated.title,
            updatedAt: updated.updatedAt.toISOString(),
          };
        });
      },
    }),
});
