import { expect, it } from "bun:test";
import { createHash, randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  CalendarFeed,
  CalendarFeedLive,
} from "../../src/server/calendar/calendar-feed";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

const feed = <Value, Failure>(
  program: (service: CalendarFeed["Service"]) => Effect.Effect<Value, Failure>
) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* run() {
        return yield* program(yield* CalendarFeed);
      }),
      CalendarFeedLive
    )
  );

const insertUser = async (id: string, name: string, role = "employee") => {
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [id, name, `${id}@calendar-feed.example`, role]
  );
};

// The error code a render fails with; a successful render fails the test.
const renderFailure = async (token: string): Promise<string> => {
  const error = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* render() {
        const service = yield* CalendarFeed;
        return yield* Effect.flip(service.render(token, new Date()));
      }),
      CalendarFeedLive
    )
  );
  return error.code;
};

it("stores only a hash, shows the token once, and rotation and revocation cut off old links", async () => {
  const userId = randomUUID();
  await insertUser(userId, "Feed Owner");
  try {
    expect(await feed((service) => service.status(userId))).toEqual({
      active: false,
      createdAt: null,
      lastUsedAt: null,
    });

    const first = await feed((service) => service.rotate(userId));
    expect(first.token.length).toBeGreaterThanOrEqual(40);
    const stored = await authPool.query<{ tokenHash: string }>(
      'SELECT "tokenHash" FROM calendar_feed_token WHERE "userId" = $1',
      [userId]
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]?.tokenHash).toBe(
      createHash("sha256").update(first.token).digest("hex")
    );
    expect(stored.rows[0]?.tokenHash).not.toContain(first.token);
    const statusAfterTrue = await feed((service) => service.status(userId));
    expect(statusAfterTrue.active).toBe(true);

    const second = await feed((service) => service.rotate(userId));
    expect(second.token).not.toBe(first.token);
    const rows = await authPool.query(
      'SELECT 1 FROM calendar_feed_token WHERE "userId" = $1',
      [userId]
    );
    expect(rows.rowCount).toBe(1);

    const stale = await renderFailure(first.token);
    expect(stale).toBe("NOT_FOUND");
    const fresh = await feed((service) =>
      service.render(second.token, new Date())
    );
    expect(fresh).toContain("BEGIN:VCALENDAR");

    await feed((service) => service.revoke(userId));
    const statusAfterFalse = await feed((service) => service.status(userId));
    expect(statusAfterFalse.active).toBe(false);
    const revoked = await renderFailure(second.token);
    expect(revoked).toBe("NOT_FOUND");
  } finally {
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  }
});

it("rejects malformed and unknown tokens without leaking why", async () => {
  for (const token of [
    "",
    "short",
    "../../etc/passwd",
    "x".repeat(500),
    randomUUID(),
  ]) {
    // eslint-disable-next-line no-await-in-loop
    const result = await renderFailure(token);
    expect(result).toBe("NOT_FOUND");
  }
});

it("renders only the viewer's open tasks with due dates and their calendar events", async () => {
  const viewerId = randomUUID();
  const otherId = randomUUID();
  const projectId = randomUUID();
  const suffix = randomUUID();
  await insertUser(viewerId, "Feed Viewer");
  await insertUser(otherId, "Feed Other");
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `F${suffix.slice(0, 5)}`, "Feed project"]
  );
  const attendedEvent = randomUUID();
  const strangerEvent = randomUUID();
  const startsAt = new Date(Date.now() + 2 * 86_400_000);
  try {
    await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* createTasks() {
          const work = yield* WorkManagement;
          const base = {
            description: null,
            priority: "medium" as const,
            projectId,
          };
          yield* work.createTask(viewerId, {
            ...base,
            assigneeIds: [viewerId],
            dueDate: "2026-12-24",
            title: "Mine, due; soon",
          });
          yield* work.createTask(viewerId, {
            ...base,
            assigneeIds: [viewerId],
            dueDate: null,
            title: "Mine without date",
          });
          yield* work.createTask(otherId, {
            ...base,
            assigneeIds: [otherId],
            dueDate: "2026-12-25",
            title: "Someone else's",
          });
          const done = yield* work.createTask(viewerId, {
            ...base,
            assigneeIds: [viewerId],
            dueDate: "2026-12-26",
            title: "Already done",
          });
          yield* work.changeTaskStatus(viewerId, done.id, done.version, "done");
        }),
        WorkManagementLive
      )
    );
    await authPool.query(
      "INSERT INTO calendar_event (id, \"createdById\", title, \"startsAt\") VALUES ($1, $2, 'Sync', $3), ($4, $5, 'Private meeting', $3)",
      [attendedEvent, otherId, startsAt, strangerEvent, otherId]
    );
    await authPool.query(
      'INSERT INTO calendar_event_attendee ("eventId", "userId") VALUES ($1, $2), ($3, $4)',
      [attendedEvent, viewerId, strangerEvent, otherId]
    );

    const { token } = await feed((service) => service.rotate(viewerId));
    const text = await feed((service) => service.render(token, new Date()));

    expect(text).toContain("SUMMARY:Mine\\, due\\; soon\r\n");
    expect(text).toContain("DTSTART;VALUE=DATE:20261224\r\n");
    expect(text).not.toContain("Mine without date");
    expect(text).not.toContain("Someone else");
    expect(text).not.toContain("Already done");
    expect(text).toContain("SUMMARY:Sync\r\n");
    expect(text).not.toContain("Private meeting");

    const used = await authPool.query<{ lastUsedAt: Date | null }>(
      'SELECT "lastUsedAt" FROM calendar_feed_token WHERE "userId" = $1',
      [viewerId]
    );
    expect(used.rows[0]?.lastUsedAt).not.toBeNull();
  } finally {
    await authPool.query(
      "DELETE FROM calendar_event WHERE id = ANY($1::uuid[])",
      [[attendedEvent, strangerEvent]]
    );
    await authPool.query(
      'DELETE FROM undo_record WHERE "actorId" = ANY($1::text[])',
      [[viewerId, otherId]]
    );
    await authPool.query(
      'DELETE FROM activity WHERE "actorId" = ANY($1::text[])',
      [[viewerId, otherId]]
    );
    await authPool.query('DELETE FROM task WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
      [viewerId, otherId],
    ]);
  }
});

it("stops serving the feed once the account is deactivated", async () => {
  const adminId = randomUUID();
  const userId = randomUUID();
  await insertUser(adminId, "Feed Admin", "admin");
  await insertUser(userId, "Feed Leaver");
  try {
    const { token } = await feed((service) => service.rotate(userId));
    await authPool.query(
      'UPDATE "user" SET "deactivatedAt" = now(), "deactivatedById" = $2 WHERE id = $1',
      [userId, adminId]
    );
    const result = await renderFailure(token);
    expect(result).toBe("NOT_FOUND");
  } finally {
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [adminId]);
  }
});
