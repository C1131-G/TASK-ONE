import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Exit } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  Notifications,
  NotificationsLive,
} from "../../src/server/notifications/service";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("rejects notification preferences with invalid persisted enum values", async () => {
  const userId = randomUUID();
  const preferenceId = randomUUID();
  const email = `${userId}@notification-preference.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [userId, "Preference Reader", email]
  );
  await authPool.query(
    "INSERT INTO notification_preference (id, \"userId\", channel, \"eventType\") VALUES ($1, $2, 'email', 'unknown')",
    [preferenceId, userId]
  );

  try {
    const result = await Effect.runPromiseExit(
      Effect.provide(
        Effect.gen(function* listPreferences() {
          const notifications = yield* Notifications;
          return yield* notifications.listPreferences(userId);
        }),
        NotificationsLive
      )
    );

    expect(Exit.isFailure(result)).toBe(true);
  } finally {
    await authPool.query(
      'DELETE FROM notification_preference WHERE "userId" = $1',
      [userId]
    );
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  }
});

it("marks one recipient's notification read through the inbox service", async () => {
  const userId = randomUUID();
  const notificationId = randomUUID();
  const email = `${userId}@notification-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [userId, "Notification Recipient", email, "employee"]
  );
  await authPool.query(
    'INSERT INTO notification (id, "userId", type, text) VALUES ($1, $2, $3, $4)',
    [notificationId, userId, "mention", "A colleague mentioned you"]
  );

  try {
    const program = Effect.gen(function* program() {
      const notifications = yield* Notifications;
      yield* notifications.markRead(userId, notificationId);
      return yield* notifications.listInbox(userId, {
        limit: 20,
        unreadOnly: true,
      });
    });
    const inbox = await Effect.runPromise(
      Effect.provide(program, NotificationsLive)
    );

    expect(inbox.items).toEqual([]);
    expect(inbox.unreadCount).toBe(0);
  } finally {
    await authPool.query('DELETE FROM notification WHERE "userId" = $1', [
      userId,
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  }
});

it("separates unread inbox items from unread update notifications", async () => {
  const userId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [userId, "Unread Count Reader", `${userId}@unread-count.example`]
  );
  await authPool.query(
    "INSERT INTO notification (id, \"userId\", type, text) VALUES ($1, $2, 'mention', $3), ($4, $2, 'update', $5)",
    [randomUUID(), userId, "A new mention", randomUUID(), "A task update"]
  );

  try {
    const inbox = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* listInbox() {
          const notifications = yield* Notifications;
          return yield* notifications.listInbox(userId, {
            limit: 20,
            unreadOnly: false,
          });
        }),
        NotificationsLive
      )
    );

    expect(inbox.unreadCount).toBe(2);
    expect(inbox.unreadInboxCount).toBe(1);
  } finally {
    await authPool.query('DELETE FROM notification WHERE "userId" = $1', [
      userId,
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  }
});

it("includes the linked project name in each inbox notification", async () => {
  const userId = randomUUID();
  const projectId = randomUUID();
  const notificationId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [userId, "Inbox Reader", `${userId}@inbox-project.example`]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `I${userId.slice(0, 6)}`, "Inbox Project"]
  );
  await authPool.query(
    'INSERT INTO notification (id, "userId", "projectId", type, text) VALUES ($1, $2, $3, \'update\', $4)',
    [notificationId, userId, projectId, "A project update"]
  );

  try {
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

    expect(inbox.items[0]?.projectName).toBe("Inbox Project");
  } finally {
    await authPool.query('DELETE FROM notification WHERE "userId" = $1', [
      userId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  }
});

it("delivers one local 9 a.m. due summary and suppresses duplicate scans", async () => {
  const userId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  const email = `${userId}@due-summary-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [userId, "Due Summary User", email, "employee"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `DU${userId.slice(0, 5)}`, "Due summary project"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById", "dueDate") VALUES ($1, $2, 1, $3, $4, $5)',
    [taskId, projectId, "Overdue review", userId, "2026-10-08"]
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
      JSON.stringify({ timezone: "Asia/Kolkata" }),
    ]
  );

  try {
    const scheduledAt = new Date("2026-10-08T03:30:00.000Z");
    const send = Effect.gen(function* sendSummary() {
      const notifications = yield* Notifications;
      return yield* notifications.sendDailyDueSummaries(scheduledAt);
    });
    const first = await Effect.runPromise(
      Effect.provide(send, NotificationsLive)
    );
    const second = await Effect.runPromise(
      Effect.provide(send, NotificationsLive)
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
    const pushJobs = await authPool.query(
      "SELECT id FROM job WHERE kind = $1 AND payload->>'userId' = $2",
      ["notifications.deliver-push", userId]
    );

    expect(first.usersNotified).toBe(1);
    expect(second.usersNotified).toBe(0);
    expect(inbox.items).toHaveLength(1);
    expect(inbox.items[0]).toMatchObject({
      snippet: "Overdue review",
      type: "due",
    });
    expect(pushJobs.rows).toHaveLength(1);
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
