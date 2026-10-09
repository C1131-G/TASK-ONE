"use server";

import { Effect, Schema } from "effect";
import { headers } from "next/headers";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import { runServerAction } from "@/src/server/core/server-action";
import {
  TaskCalendar,
  TaskCalendarEntrySchema,
  TaskCalendarLive,
  TaskCalendarQuerySchema,
} from "@/src/server/work/task-calendar";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listTaskCalendarAction(input: unknown) {
  return await runServerAction(
    input,
    TaskCalendarQuerySchema,
    (validated) =>
      Effect.gen(function* listTaskCalendar() {
        const requestHeaders = yield* Effect.tryPromise({
          catch: () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            }),
          try: () => headers(),
        });
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
}
