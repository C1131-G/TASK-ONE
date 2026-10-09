import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import {
  PushNotifications,
  PushNotificationsLive,
} from "../../src/server/notifications/push";
import { PushTransport } from "../../src/server/notifications/push-transport";
import type { PushMessage } from "../../src/server/notifications/push-transport";

interface Fixture {
  readonly endpoint: string;
  readonly message: PushMessage;
  readonly sentNotificationIds: string[];
  readonly userId: string;
  readonly actorId: string;
}

const identifier = (id: string) => id.replaceAll("-", "_");

const seedFixture = async (): Promise<Fixture> => {
  const userId = randomUUID();
  const actorId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false), ($4, $5, $6, $6, \'employee\', false)',
    [
      userId,
      "Push Failure Recipient",
      `${userId}@push-failure.example`,
      actorId,
      "Push Failure Actor",
      `${actorId}@push-failure.example`,
    ]
  );
  return {
    actorId,
    endpoint: `https://fcm.googleapis.com/${randomUUID()}`,
    message: {
      actorId,
      body: "Please review",
      eventType: "mention",
      notificationId: randomUUID(),
      title: "A teammate mentioned you",
      url: "/tasks/example",
    },
    sentNotificationIds: [],
    userId,
  };
};

const removeFixture = async ({ actorId, userId }: Fixture) => {
  await authPool.query('DELETE FROM push_delivery WHERE "userId" = $1', [
    userId,
  ]);
  await authPool.query('DELETE FROM push_subscription WHERE "userId" = $1', [
    userId,
  ]);
  await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
    [userId, actorId],
  ]);
};

const layerFor = (fixture: Fixture) =>
  Layer.provide(
    PushNotificationsLive,
    Layer.succeed(
      PushTransport,
      PushTransport.of({
        send: (_subscription, pushMessage) => {
          fixture.sentNotificationIds.push(pushMessage.notificationId);
          return Effect.succeed("delivered");
        },
      })
    )
  );

const register = (fixture: Fixture) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* registerSubscription() {
        const push = yield* PushNotifications;
        yield* push.register(fixture.userId, {
          endpoint: fixture.endpoint,
          keys: { auth: "auth-key-123456", p256dh: "public-key-1234567890" },
          userAgent: "test browser",
        });
      }),
      layerFor(fixture)
    )
  );

const deliver = (fixture: Fixture) =>
  runEffectResult(
    Effect.provide(
      Effect.gen(function* deliverPush() {
        const push = yield* PushNotifications;
        return yield* push.deliver(fixture.userId, fixture.message);
      }),
      layerFor(fixture)
    )
  );

const receiptCount = async (fixture: Fixture): Promise<number> => {
  const rows = await authPool.query(
    'SELECT id FROM push_delivery WHERE "userId" = $1',
    [fixture.userId]
  );
  return rows.rows.length;
};

const installFailingTrigger = async (
  fixture: Fixture,
  failuresBeforeSuccess: number | null
) => {
  const name = `push_fail_${identifier(fixture.userId)}`;
  // A sequence is not rolled back with the failed insert, so it counts attempts.
  await authPool.query(`CREATE SEQUENCE ${name}_seq`);
  const condition =
    failuresBeforeSuccess === null
      ? "TRUE"
      : `nextval('${name}_seq') <= ${failuresBeforeSuccess}`;
  await authPool.query(
    `CREATE FUNCTION ${name}_fn() RETURNS trigger LANGUAGE plpgsql AS $body$
     BEGIN
       IF NEW."userId" = '${fixture.userId}' AND ${condition} THEN
         RAISE EXCEPTION 'simulated receipt write failure';
       END IF;
       RETURN NEW;
     END $body$`
  );
  await authPool.query(
    `CREATE TRIGGER ${name}_trg BEFORE INSERT ON push_delivery FOR EACH ROW EXECUTE FUNCTION ${name}_fn()`
  );
  return name;
};

const removeTrigger = async (name: string) => {
  await authPool.query(`DROP TRIGGER IF EXISTS ${name}_trg ON push_delivery`);
  await authPool.query(`DROP FUNCTION IF EXISTS ${name}_fn()`);
  await authPool.query(`DROP SEQUENCE IF EXISTS ${name}_seq`);
};

it("records the receipt on retry when a transient database error follows a provider send", async () => {
  const fixture = await seedFixture();
  let triggerName: string | null = null;
  try {
    await register(fixture);
    triggerName = await installFailingTrigger(fixture, 1);

    const outcome = await deliver(fixture);

    expect(outcome).toMatchObject({
      data: { delivered: 1, expired: 0 },
      ok: true,
    });
    expect(fixture.sentNotificationIds).toEqual([
      fixture.message.notificationId,
    ]);
    expect(await receiptCount(fixture)).toBe(1);
  } finally {
    if (triggerName) {
      await removeTrigger(triggerName);
    }
    await removeFixture(fixture);
  }
});

it("resends with the same collapse identifier after a persistent receipt failure and then stops", async () => {
  const fixture = await seedFixture();
  let triggerName: string | null = null;
  try {
    await register(fixture);
    triggerName = await installFailingTrigger(fixture, null);

    const failed = await deliver(fixture);
    expect(failed).toMatchObject({
      error: { code: "UNAVAILABLE" },
      ok: false,
    });
    expect(fixture.sentNotificationIds).toEqual([
      fixture.message.notificationId,
    ]);
    expect(await receiptCount(fixture)).toBe(0);

    await removeTrigger(triggerName);
    triggerName = null;

    const retried = await deliver(fixture);
    expect(retried).toMatchObject({
      data: { delivered: 1, expired: 0 },
      ok: true,
    });
    // The retry is a duplicate send, but it carries the same notification ID,
    // which the transport turns into the Web Push topic and the payload tag,
    // so the client replaces the first notification instead of showing two.
    expect(fixture.sentNotificationIds).toEqual([
      fixture.message.notificationId,
      fixture.message.notificationId,
    ]);
    expect(await receiptCount(fixture)).toBe(1);

    const afterReceipt = await deliver(fixture);
    expect(afterReceipt).toMatchObject({
      data: { delivered: 0, expired: 0 },
      ok: true,
    });
    expect(fixture.sentNotificationIds).toHaveLength(2);
  } finally {
    if (triggerName) {
      await removeTrigger(triggerName);
    }
    await removeFixture(fixture);
  }
});
