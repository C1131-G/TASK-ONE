import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  Notifications,
  NotificationsLive,
} from "../../src/server/notifications/service";

it("lists the signed-in employee's saved notification channel preferences", async () => {
  const userId = randomUUID();
  const email = `${userId}@notification-preferences.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [userId, "Notification Preferences", email]
  );
  await authPool.query(
    "INSERT INTO notification_preference (id, \"userId\", channel, \"eventType\", enabled) VALUES ($1, $2, 'in-app', 'comment', false), ($3, $2, 'web-push', 'assignment', true)",
    [randomUUID(), userId, randomUUID()]
  );

  try {
    const preferences = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* listPreferences() {
          const notifications = yield* Notifications;
          return yield* notifications.listPreferences(userId);
        }),
        NotificationsLive
      )
    );

    expect(preferences).toEqual([
      { channel: "in-app", enabled: false, eventType: "comment" },
      { channel: "web-push", enabled: true, eventType: "assignment" },
    ]);
  } finally {
    await authPool.query(
      'DELETE FROM notification_preference WHERE "userId" = $1',
      [userId]
    );
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  }
});
