import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import type { AppError } from "../../src/server/core/action-result";
import {
  Notifications,
  NotificationsLive,
} from "../../src/server/notifications/service";

const withNotifications = <Value>(
  program: (
    notifications: Notifications["Service"]
  ) => Effect.Effect<Value, AppError>
) =>
  Effect.runPromise(
    Effect.provide(
      Effect.flatMap(Effect.service(Notifications), program),
      NotificationsLive
    )
  );

it("saves email preferences only for events that can be emailed", async () => {
  const userId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [userId, "Email Preferences", `${userId}@notification-email-prefs.example`]
  );

  try {
    await withNotifications((notifications) =>
      notifications.setPreference(userId, "email", "assignment", true)
    );
    const rejected = await Effect.runPromise(
      Effect.flip(
        Effect.provide(
          Effect.flatMap(Effect.service(Notifications), (notifications) =>
            notifications.setPreference(userId, "email", "due", true)
          ),
          NotificationsLive
        )
      )
    );
    const preferences = await withNotifications((notifications) =>
      notifications.listPreferences(userId)
    );

    expect(rejected.code).toBe("VALIDATION_FAILED");
    expect(preferences).toEqual([
      { channel: "email", enabled: true, eventType: "assignment" },
    ]);
  } finally {
    await authPool.query(
      'DELETE FROM notification_preference WHERE "userId" = $1',
      [userId]
    );
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  }
});
