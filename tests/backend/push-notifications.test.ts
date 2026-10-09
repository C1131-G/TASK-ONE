import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import { AppError, runEffectResult } from "../../src/server/core/action-result";
import {
  PushNotifications,
  PushNotificationsLive,
} from "../../src/server/notifications/push";
import { PushTransport } from "../../src/server/notifications/push-transport";
import type { PushMessage } from "../../src/server/notifications/push-transport";

const dbDisablePushPreference = async (userId: string): Promise<void> => {
  await authPool.query(
    "INSERT INTO notification_preference (id, \"userId\", channel, \"eventType\", enabled) VALUES ($1, $2, 'web-push', 'mention', false)",
    [randomUUID(), userId]
  );
};

it("registers, delivers to, preference-gates, and removes a push subscription", async () => {
  const userId = randomUUID();
  const actorId = randomUUID();
  const notificationId = randomUUID();
  const endpoint = `https://fcm.googleapis.com/${randomUUID()}`;
  const deliveredIds: string[] = [];
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false), ($4, $5, $6, $6, \'employee\', false)',
    [
      userId,
      "Push Recipient",
      `${userId}@push-test.example`,
      actorId,
      "Push Actor",
      `${actorId}@push-test.example`,
    ]
  );
  const message: PushMessage = {
    actorId,
    body: "Please review",
    eventType: "mention",
    notificationId,
    title: "A teammate mentioned you",
    url: "/tasks/example",
  };
  const transportLayer = Layer.succeed(
    PushTransport,
    PushTransport.of({
      send: (_subscription, pushMessage) => {
        deliveredIds.push(pushMessage.notificationId);
        return Effect.succeed("delivered");
      },
    })
  );
  const layer = Layer.provide(PushNotificationsLive, transportLayer);

  try {
    const registerProgram = Effect.gen(function* program() {
      const push = yield* PushNotifications;
      yield* push.register(userId, {
        endpoint,
        keys: { auth: "auth-key-123456", p256dh: "public-key-1234567890" },
        userAgent: "test browser",
      });
      return yield* push.deliver(userId, message);
    });
    const firstDelivery = await Effect.runPromise(
      Effect.provide(registerProgram, layer)
    );
    const duplicateProgram = Effect.gen(function* program() {
      const push = yield* PushNotifications;
      return yield* push.deliver(userId, message);
    });
    const duplicateDelivery = await Effect.runPromise(
      Effect.provide(duplicateProgram, layer)
    );
    await dbDisablePushPreference(userId);
    const disabledProgram = Effect.gen(function* program() {
      const push = yield* PushNotifications;
      return yield* push.deliver(userId, message);
    });
    const disabledDelivery = await Effect.runPromise(
      Effect.provide(disabledProgram, layer)
    );
    const removeProgram = Effect.gen(function* program() {
      const push = yield* PushNotifications;
      yield* push.unregister(userId, endpoint);
      return yield* push.deliver(userId, message);
    });
    const afterRemoval = await Effect.runPromise(
      Effect.provide(removeProgram, layer)
    );

    expect(firstDelivery).toEqual({ delivered: 1, expired: 0 });
    expect(duplicateDelivery).toEqual({ delivered: 0, expired: 0 });
    expect(disabledDelivery).toEqual({ delivered: 0, expired: 0 });
    expect(afterRemoval).toEqual({ delivered: 0, expired: 0 });
    expect(deliveredIds).toEqual([notificationId]);
  } finally {
    await authPool.query('DELETE FROM push_delivery WHERE "userId" = $1', [
      userId,
    ]);
    await authPool.query('DELETE FROM push_subscription WHERE "userId" = $1', [
      userId,
    ]);
    await authPool.query(
      'DELETE FROM notification_preference WHERE "userId" = $1',
      [userId]
    );
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});

it("rejects non-HTTPS push endpoints before storing them", async () => {
  const userId = randomUUID();
  const email = `${userId}@invalid-push-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [userId, "Push Recipient", email]
  );
  const transportLayer = Layer.succeed(
    PushTransport,
    PushTransport.of({ send: () => Effect.succeed("delivered") })
  );
  const program = Effect.gen(function* program() {
    const push = yield* PushNotifications;
    yield* push.register(userId, {
      endpoint: "http://localhost/push",
      keys: { auth: "auth-key-123456", p256dh: "public-key-1234567890" },
      userAgent: null,
    });
  });

  try {
    const result = await runEffectResult(
      Effect.provide(
        program,
        Layer.provide(PushNotificationsLive, transportLayer)
      )
    );
    expect(result).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
      ok: false,
    });
  } finally {
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  }
});

it("removes expired provider endpoints so later deliveries stop retrying them", async () => {
  const userId = randomUUID();
  const subscriptionId = randomUUID();
  const email = `${userId}@expired-push-test.example`;
  const endpoint = `https://fcm.googleapis.com/${subscriptionId}`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [userId, "Expired Push Recipient", email]
  );
  await authPool.query(
    'INSERT INTO push_subscription (id, "userId", endpoint, keys) VALUES ($1, $2, $3, $4::jsonb)',
    [
      subscriptionId,
      userId,
      endpoint,
      JSON.stringify({
        auth: "auth-key-123456",
        p256dh: "public-key-1234567890",
      }),
    ]
  );
  const transportLayer = Layer.succeed(
    PushTransport,
    PushTransport.of({
      send: () =>
        Effect.fail(
          new AppError({
            code: "NOT_FOUND",
            message: "The push endpoint has expired.",
          })
        ),
    })
  );
  const layer = Layer.provide(PushNotificationsLive, transportLayer);
  const message: PushMessage = {
    actorId: randomUUID(),
    body: "Your assignment changed",
    eventType: "assignment",
    notificationId: randomUUID(),
    title: "Assignment",
    url: "/tasks/example",
  };

  try {
    const program = Effect.gen(function* program() {
      const push = yield* PushNotifications;
      const first = yield* push.deliver(userId, message);
      const second = yield* push.deliver(userId, message);
      return { first, second };
    });
    const result = await Effect.runPromise(Effect.provide(program, layer));
    expect(result.first).toEqual({ delivered: 0, expired: 1 });
    expect(result.second).toEqual({ delivered: 0, expired: 0 });
  } finally {
    await authPool.query('DELETE FROM push_subscription WHERE "userId" = $1', [
      userId,
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  }
});
