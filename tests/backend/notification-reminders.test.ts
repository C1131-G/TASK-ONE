import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  Notifications,
  NotificationsLive,
} from "../../src/server/notifications/service";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("sends due summaries at 9 a.m. across New York daylight and standard time", async () => {
  const userId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [userId, "New York Due User", `${userId}@timezone-summary-test.example`]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `TZ${userId.slice(0, 5)}`, "Timezone summary project"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById", "dueDate") VALUES ($1, $2, 1, $3, $4, $5)',
    [taskId, projectId, "Overdue across DST", userId, "2026-01-01"]
  );
  await authPool.query(
    'INSERT INTO task_assignee ("taskId", "userId", "assignedById") VALUES ($1, $2, $2)',
    [taskId, userId]
  );
  await authPool.query(
    'INSERT INTO user_preference (id, "userId", key, value) VALUES ($1, $2, $3, $4::jsonb)',
    [
      randomUUID(),
      userId,
      "display",
      JSON.stringify({ timezone: "America/New_York" }),
    ]
  );

  try {
    const scans = [
      new Date("2026-07-08T12:00:00.000Z"),
      new Date("2026-07-08T13:00:00.000Z"),
      new Date("2026-11-08T13:00:00.000Z"),
      new Date("2026-11-08T14:00:00.000Z"),
    ];
    const counts = await Promise.all(
      scans.map(async (scheduledAt) => {
        const scan = Effect.gen(function* sendSummary() {
          const notifications = yield* Notifications;
          return yield* notifications.sendDailyDueSummaries(scheduledAt);
        });
        const result = await Effect.runPromise(
          Effect.provide(scan, NotificationsLive)
        );
        return result.usersNotified;
      })
    );
    const inbox = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* listInbox() {
          const notifications = yield* Notifications;
          return yield* notifications.listInbox(userId, {
            limit: 10,
            unreadOnly: false,
          });
        }),
        NotificationsLive
      )
    );

    expect(counts).toEqual([0, 1, 0, 1]);
    expect(inbox.items).toHaveLength(2);
  } finally {
    await authPool.query("DELETE FROM job WHERE payload->>'userId' = $1", [
      userId,
    ]);
    await authPool.query('DELETE FROM notification WHERE "userId" = $1', [
      userId,
    ]);
    await authPool.query('DELETE FROM user_preference WHERE "userId" = $1', [
      userId,
    ]);
    await authPool.query('DELETE FROM task_assignee WHERE "userId" = $1', [
      userId,
    ]);
    await authPool.query("DELETE FROM task WHERE id = $1", [taskId]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  }
});

it("uses the company timezone for employees without a personal timezone", async () => {
  const userId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [userId, "Company Timezone User", `${userId}@company-timezone-test.example`]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `CT${userId.slice(0, 5)}`, "Company timezone project"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById", "dueDate") VALUES ($1, $2, 1, $3, $4, $5)',
    [taskId, projectId, "Due in company timezone", userId, "2026-01-01"]
  );
  await authPool.query(
    'INSERT INTO task_assignee ("taskId", "userId", "assignedById") VALUES ($1, $2, $2)',
    [taskId, userId]
  );

  try {
    const scan = Effect.gen(function* sendSummary() {
      const notifications = yield* Notifications;
      return yield* notifications.sendDailyDueSummaries(
        new Date("2026-01-15T03:30:00.000Z")
      );
    });
    const result = await Effect.runPromise(
      Effect.provide(scan, NotificationsLive)
    );
    expect(result.usersNotified).toBe(1);
  } finally {
    await authPool.query("DELETE FROM job WHERE payload->>'userId' = $1", [
      userId,
    ]);
    await authPool.query('DELETE FROM notification WHERE "userId" = $1', [
      userId,
    ]);
    await authPool.query('DELETE FROM task_assignee WHERE "userId" = $1', [
      userId,
    ]);
    await authPool.query("DELETE FROM task WHERE id = $1", [taskId]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  }
});
