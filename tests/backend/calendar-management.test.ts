import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  CalendarManagement,
  CalendarManagementLive,
} from "../../src/server/calendar/calendar-management";
import { runEffectResult } from "../../src/server/core/action-result";

it("lets admins manage calendar events and gives employees read access", async () => {
  await authPool.query(
    'DELETE FROM calendar_event WHERE "createdById" IN (SELECT id FROM "user" WHERE email LIKE \'%@calendar-test.example\')'
  );
  await authPool.query('DELETE FROM "user" WHERE email LIKE $1', [
    "%@calendar-test.example",
  ]);
  const adminId = randomUUID();
  const employeeId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false), ($5, $6, $7, $7, $8, false)',
    [
      adminId,
      "Calendar Admin",
      `${adminId}@calendar-test.example`,
      "admin",
      employeeId,
      "Calendar Employee",
      `${employeeId}@calendar-test.example`,
      "employee",
    ]
  );

  try {
    const start = new Date(Date.now() + 86_400_000);
    const end = new Date(start.getTime() + 3_600_000);
    const create = Effect.gen(function* createEvent() {
      const calendar = yield* CalendarManagement;
      const event = yield* calendar.createEvent(adminId, {
        attendeeIds: [employeeId],
        description: "Planning",
        endsAt: end,
        location: "Studio",
        projectId: null,
        startsAt: start,
        title: "Sprint review",
      });
      const historical = yield* calendar.createEvent(adminId, {
        attendeeIds: [],
        description: null,
        endsAt: null,
        location: null,
        projectId: null,
        startsAt: new Date("2000-01-01T00:00:00.000Z"),
        title: "Historical reminder",
      });
      const events = yield* calendar.listEvents(employeeId, start, end);
      return { event, events, historicalId: historical.id };
    });
    const result = await Effect.runPromise(
      Effect.provide(create, CalendarManagementLive)
    );
    const denied = await runEffectResult(
      Effect.provide(
        Effect.gen(function* tryEmployeeWrite() {
          const calendar = yield* CalendarManagement;
          return yield* calendar.createEvent(employeeId, {
            attendeeIds: [],
            description: null,
            endsAt: null,
            location: null,
            projectId: null,
            startsAt: start,
            title: "Nope",
          });
        }),
        CalendarManagementLive
      )
    );
    const updated = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* updateEvent() {
          const calendar = yield* CalendarManagement;
          return yield* calendar.updateEvent(adminId, result.event.id, {
            attendeeIds: [],
            description: "Updated planning",
            endsAt: end,
            location: "Main studio",
            projectId: null,
            startsAt: start,
            title: "Updated sprint review",
          });
        }),
        CalendarManagementLive
      )
    );
    const deleteEvent = Effect.gen(function* deleteEvent() {
      const calendar = yield* CalendarManagement;
      yield* calendar.deleteEvent(adminId, result.event.id);
      yield* calendar.deleteEvent(adminId, result.historicalId);
      return yield* calendar.listEvents(employeeId, start, end);
    });
    const eventsAfterDelete = await Effect.runPromise(
      Effect.provide(deleteEvent, CalendarManagementLive)
    );

    expect(result.events.map(({ id }) => id)).toEqual([result.event.id]);
    expect(result.event.attendeeIds).toEqual([employeeId]);
    expect(denied).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
    expect(updated.title).toBe("Updated sprint review");
    expect(eventsAfterDelete).toHaveLength(0);
  } finally {
    await authPool.query(
      'DELETE FROM calendar_event WHERE "createdById" = ANY($1::text[])',
      [[adminId]]
    );
    await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
      [adminId, employeeId],
    ]);
  }
});
