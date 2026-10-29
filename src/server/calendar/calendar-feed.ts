import { createHash, randomBytes, randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { buildCalendar } from "./ical";
import type { FeedEvent, FeedTask } from "./ical";

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/u;
const MS_PER_DAY = 86_400_000;
const PAST_DAYS = 30;
const FUTURE_DAYS = 365;
const MAX_FEED_TASKS = 2000;
const MAX_FEED_EVENTS = 1000;
// A polled feed must not turn every refresh into a write.
const LAST_USED_REFRESH_MS = 60 * 60 * 1000;

export const CalendarFeedStatusSchema = Schema.Struct({
  active: Schema.Boolean,
  createdAt: Schema.NullOr(Schema.String),
  lastUsedAt: Schema.NullOr(Schema.String),
});
export type CalendarFeedStatus = typeof CalendarFeedStatusSchema.Type;

export interface RotatedCalendarFeed {
  readonly createdAt: string;
  // Shown once; only its hash is stored.
  readonly token: string;
}

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const notFound = () =>
  new AppError({
    code: "NOT_FOUND",
    message: "This calendar link is not valid.",
  });

const unavailable = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The calendar feed could not be loaded or saved.",
      });

const requireFeedUser = async (userId: string): Promise<void> => {
  const user = await db.orm.public.User.where({ id: userId })
    .select("deactivatedAt", "mustChangePassword", "role")
    .first();
  if (!user || user.deactivatedAt || user.role === "client") {
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

const status = (userId: string) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<CalendarFeedStatus> => {
      await requireFeedUser(userId);
      const row = await db.orm.public.CalendarFeedToken.where({ userId })
        .select("createdAt", "lastUsedAt")
        .first();
      return {
        active: row !== null,
        createdAt: row?.createdAt.toISOString() ?? null,
        lastUsedAt: row?.lastUsedAt?.toISOString() ?? null,
      };
    },
  });

const rotate = (userId: string) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<RotatedCalendarFeed> => {
      await requireFeedUser(userId);
      const token = randomBytes(TOKEN_BYTES).toString("base64url");
      const createdAt = new Date();
      await db.orm.public.CalendarFeedToken.upsert({
        conflictOn: { userId },
        create: {
          createdAt,
          id: randomUUID(),
          lastUsedAt: null,
          tokenHash: hashToken(token),
          userId,
        },
        update: {
          createdAt,
          lastUsedAt: null,
          tokenHash: hashToken(token),
        },
      });
      return { createdAt: createdAt.toISOString(), token };
    },
  });

const revoke = (userId: string) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<void> => {
      await requireFeedUser(userId);
      await db.orm.public.CalendarFeedToken.where({ userId }).delete();
    },
  });

const loadTasks = async (userId: string): Promise<readonly FeedTask[]> => {
  const assignments = await db.orm.public.TaskAssignee.where({ userId })
    .select("taskId")
    .all();
  if (assignments.length === 0) {
    return [];
  }
  const tasks = await db.orm.public.Task.where((task) =>
    and(
      task.id.in(assignments.map(({ taskId }) => taskId)),
      task.archivedAt.isNull(),
      task.dueDate.isNotNull(),
      task.status.neq("done")
    )
  )
    .orderBy((task) => task.dueDate.asc())
    .limit(MAX_FEED_TASKS)
    .all();
  const projects = await db.orm.public.Project.where((project) =>
    project.id.in([...new Set(tasks.map(({ projectId }) => projectId))])
  )
    .select("id", "name")
    .all();
  const projectNames = new Map(projects.map(({ id, name }) => [id, name]));
  return tasks.flatMap((task) =>
    task.dueDate
      ? [
          {
            description: task.description,
            dueDate: task.dueDate,
            id: task.id,
            projectName: projectNames.get(task.projectId) ?? "",
            title: task.title,
          },
        ]
      : []
  );
};

// Events the viewer made or attends, plus company-wide events nobody was
// specifically invited to, as the workspace calendar shows them.
const loadEvents = async (
  userId: string,
  now: Date
): Promise<readonly FeedEvent[]> => {
  const from = new Date(now.getTime() - PAST_DAYS * MS_PER_DAY);
  const to = new Date(now.getTime() + FUTURE_DAYS * MS_PER_DAY);
  const events = await db.orm.public.CalendarEvent.where((event) =>
    and(event.startsAt.gte(from), event.startsAt.lt(to))
  )
    .orderBy((event) => event.startsAt.asc())
    .limit(MAX_FEED_EVENTS)
    .all();
  if (events.length === 0) {
    return [];
  }
  const attendees = await db.orm.public.CalendarEventAttendee.where((row) =>
    row.eventId.in(events.map(({ id }) => id))
  )
    .select("eventId", "userId")
    .all();
  const attendeesByEvent = new Map<string, string[]>();
  for (const { eventId, userId: attendeeId } of attendees) {
    attendeesByEvent.set(eventId, [
      ...(attendeesByEvent.get(eventId) ?? []),
      attendeeId,
    ]);
  }
  return events.flatMap((event) => {
    const invited = attendeesByEvent.get(event.id) ?? [];
    const visible =
      event.createdById === userId ||
      invited.length === 0 ||
      invited.includes(userId);
    return visible
      ? [
          {
            description: event.description,
            endsAt: event.endsAt,
            id: event.id,
            location: event.location,
            startsAt: event.startsAt,
            title: event.title,
          },
        ]
      : [];
  });
};

const render = (token: string, now: Date) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<string> => {
      if (!TOKEN_PATTERN.test(token)) {
        throw notFound();
      }
      const row = await db.orm.public.CalendarFeedToken.where({
        tokenHash: hashToken(token),
      }).first();
      if (!row) {
        throw notFound();
      }
      const user = await db.orm.public.User.where({ id: row.userId })
        .select("deactivatedAt", "mustChangePassword", "name", "role")
        .first();
      if (
        !user ||
        user.deactivatedAt ||
        user.mustChangePassword ||
        user.role === "client"
      ) {
        throw notFound();
      }
      if (
        !row.lastUsedAt ||
        now.getTime() - row.lastUsedAt.getTime() > LAST_USED_REFRESH_MS
      ) {
        await db.orm.public.CalendarFeedToken.where({
          id: row.id,
        }).updateAndCount({ lastUsedAt: now });
      }
      const [tasks, events] = await Promise.all([
        loadTasks(row.userId),
        loadEvents(row.userId, now),
      ]);
      return buildCalendar({
        events,
        name: `Taskora - ${user.name}`,
        now,
        tasks,
      });
    },
  });

export class CalendarFeed extends Context.Service<
  CalendarFeed,
  {
    readonly status: (
      userId: string
    ) => Effect.Effect<CalendarFeedStatus, AppError>;
    readonly rotate: (
      userId: string
    ) => Effect.Effect<RotatedCalendarFeed, AppError>;
    readonly revoke: (userId: string) => Effect.Effect<void, AppError>;
    // Serves the feed for a secret token; every invalid token is NOT_FOUND.
    readonly render: (
      token: string,
      now: Date
    ) => Effect.Effect<string, AppError>;
  }
>()("taskora/server/CalendarFeed") {}

export const CalendarFeedLive = Layer.succeed(CalendarFeed, {
  render,
  revoke,
  rotate,
  status,
});
