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
