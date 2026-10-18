import "server-only";
import { Effect, Schema } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import {
  CalendarEventListSchema,
  CalendarManagement,
  CalendarManagementLive,
} from "@/src/server/calendar/calendar-management";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  TaskCalendar,
  TaskCalendarEntrySchema,
  TaskCalendarLive,
  TaskCalendarQuerySchema,
} from "@/src/server/work/task-calendar";
import type { TaskCalendarQuery } from "@/src/server/work/task-calendar-contracts";

export const listCalendarEvents = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({ from: Schema.DateFromString, to: Schema.DateFromString }),
    (validated) =>
      Effect.gen(function* listEvents() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const calendar = yield* CalendarManagement;
        return yield* calendar.listEvents(
          user.id,
          validated.from,
          validated.to
        );
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(CalendarManagementLive)
      ),
    undefined,
    CalendarEventListSchema
  );

export const listTaskCalendar = async (input: unknown) =>
  await runServerAction(
    input,
    TaskCalendarQuerySchema,
    (validated) =>
      Effect.gen(function* listTaskCalendarProgram() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const calendar = yield* TaskCalendar;
        return yield* calendar.list(actor.id, validated);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(TaskCalendarLive)
      ),
    undefined,
    Schema.Array(TaskCalendarEntrySchema)
  );

export const listTaskCalendarPage = async (input: TaskCalendarQuery) => {
  const offset = input.offset ?? 0;
  const result = await listTaskCalendar({ ...input, limit: 200, offset });
  if (!result.ok) {
    return result;
  }
  return {
    ...result,
    data: {
      entries: result.data,
      nextOffset:
        result.data.length === 200 ? offset + result.data.length : null,
    },
  };
};

export const listAllTaskCalendar = async (input: TaskCalendarQuery) => {
  const entries: (typeof TaskCalendarEntrySchema.Type)[] = [];
  const { offset: startingOffset = 0, ...query } = input;
  let offset = startingOffset;
  let requestId = "";
  while (true) {
    // Each next page starts after the preceding page's final stable sort key.
    // eslint-disable-next-line no-await-in-loop -- Pagination depends on the previous page length.
    const result = await listTaskCalendarPage({ ...query, limit: 200, offset });
    if (!result.ok) {
      return result;
    }
    const { data, requestId: pageRequestId } = result;
    requestId = pageRequestId;
    const { entries: pageEntries, nextOffset } = data;
    entries.push(...pageEntries);
    if (nextOffset === null) {
      return { data: entries, ok: true as const, requestId };
    }
    offset = nextOffset;
  }
};
