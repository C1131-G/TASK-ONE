import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  CalendarEventSummarySchema,
  CalendarManagement,
  CalendarManagementLive,
} from "../../src/server/calendar/calendar-management";
import {
  Idempotency,
  IdempotencyLive,
} from "../../src/server/core/idempotency";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("replays a calendar event create with the same event and a Date start time", async () => {
  const adminId = randomUUID();
  const title = `Replayed event ${adminId.slice(0, 8)}`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false)',
    [adminId, "Calendar Admin", `${adminId}@calendar-idem.example`]
  );

  try {
    const eventInput = {
      attendeeIds: [],
      description: null,
      endsAt: new Date("2026-11-02T10:00:00.000Z"),
      location: null,
      projectId: null,
      startsAt: new Date("2026-11-02T09:00:00.000Z"),
      title,
    };
    const result = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* createEventTwice() {
          const idempotency = yield* Idempotency;
          const calendar = yield* CalendarManagement;
          const createOnce = () =>
            idempotency.run({
              actorId: adminId,
              execute: () => calendar.createEvent(adminId, eventInput),
              input: eventInput,
              key: "calendar-create-0001",
              operation: "calendar.createEvent",
              resultSchema: CalendarEventSummarySchema,
            });
          const first = yield* createOnce();
          const replayed = yield* createOnce();
          return { first, replayed };
        }),
        Layer.mergeAll(IdempotencyLive, CalendarManagementLive)
      )
    );

    expect(result.replayed.id).toBe(result.first.id);
    expect(result.replayed.startsAt).toBeInstanceOf(Date);
    expect(result.replayed.startsAt.toISOString()).toBe(
      "2026-11-02T09:00:00.000Z"
    );
    const rows = await authPool.query(
      "SELECT id FROM calendar_event WHERE title = $1",
      [title]
    );
    expect(rows.rows).toHaveLength(1);
  } finally {
    await authPool.query("DELETE FROM calendar_event WHERE title = $1", [
      title,
    ]);
    await authPool.query('DELETE FROM idempotency_key WHERE "actorId" = $1', [
      adminId,
    ]);
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      adminId,
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [adminId]);
  }
});
