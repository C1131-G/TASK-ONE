"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import {
  CalendarEventSummarySchema,
  CalendarManagement,
  CalendarManagementLive,
} from "@/src/server/calendar/calendar-management";
import { AppError } from "@/src/server/core/action-result";
import {
  DoneResultSchema,
  Idempotency,
  IdempotencyLive,
} from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { runServerAction } from "@/src/server/core/server-action";

const InputSchema = Schema.Struct({
  attendeeIds: Schema.Array(UUIDSchema),
  description: Schema.NullOr(Schema.String),
  endsAt: Schema.NullOr(Schema.DateFromString),
  location: Schema.NullOr(Schema.String),
  projectId: Schema.NullOr(UUIDSchema),
  startsAt: Schema.DateFromString,
  title: Schema.String,
});
const UpdateInputSchema = Schema.Struct({
  ...InputSchema.fields,
  eventId: UUIDSchema,
});

const getRequestHeaders = () =>
  Effect.tryPromise({
    catch: () =>
      new AppError({ code: "UNAVAILABLE", message: "Request failed." }),
    try: () => headers(),
  });

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listCalendarEventsAction(input: unknown) {
  return await runServerAction(
    input,
    Schema.Struct({ from: Schema.DateFromString, to: Schema.DateFromString }),
    (validated) =>
      Effect.gen(function* listEvents() {
        const requestHeaders = yield* getRequestHeaders();
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
      )
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function createCalendarEventAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      ...InputSchema.fields,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (validated) =>
      Effect.gen(function* createEvent() {
        const requestHeaders = yield* getRequestHeaders();
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const calendar = yield* CalendarManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...eventInput } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => calendar.createEvent(user.id, eventInput),
          input: eventInput,
          key: idempotencyKey,
          operation: "calendar.createEvent",
          resultSchema: CalendarEventSummarySchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(CalendarManagementLive),
        Effect.provide(IdempotencyLive)
      )
  );
  if (result.ok) {
    revalidatePath("/calendar");
    revalidatePath("/");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function updateCalendarEventAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      ...UpdateInputSchema.fields,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (validated) =>
      Effect.gen(function* updateEvent() {
        const requestHeaders = yield* getRequestHeaders();
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const calendar = yield* CalendarManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, eventId, ...eventInput } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            calendar.updateEvent(user.id, eventId, {
              attendeeIds: eventInput.attendeeIds,
              description: eventInput.description,
              endsAt: eventInput.endsAt,
              location: eventInput.location,
              projectId: eventInput.projectId,
              startsAt: eventInput.startsAt,
              title: eventInput.title,
            }),
          input: { ...eventInput, eventId },
          key: idempotencyKey,
          operation: "calendar.updateEvent",
          resultSchema: CalendarEventSummarySchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(CalendarManagementLive),
        Effect.provide(IdempotencyLive)
      )
  );
  if (result.ok) {
    revalidatePath("/calendar");
    revalidatePath("/");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function deleteCalendarEventAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      eventId: UUIDSchema,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (validated) =>
      Effect.gen(function* deleteEvent() {
        const requestHeaders = yield* getRequestHeaders();
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const calendar = yield* CalendarManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            calendar
              .deleteEvent(user.id, validated.eventId)
              .pipe(Effect.map(() => ({ done: true as const }))),
          input: { eventId: validated.eventId },
          key: validated.idempotencyKey,
          operation: "calendar.deleteEvent",
          resultSchema: DoneResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(CalendarManagementLive),
        Effect.provide(IdempotencyLive)
      )
  );
  if (result.ok) {
    revalidatePath("/calendar");
    revalidatePath("/");
  }
  return result;
}
