import { afterEach, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import { AppError } from "../../src/server/core/action-result";
import type { EmailEventType } from "../../src/server/email/email-events";
import {
  EmailNotifications,
  EmailNotificationsLive,
} from "../../src/server/email/email-notifications";
import { MailTransport } from "../../src/server/email/mail-transport";
import type { MailMessage } from "../../src/server/email/mail-transport";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

const sentMessages: MailMessage[] = [];
let transportFailure = false;
const transportLayer = Layer.succeed(
  MailTransport,
  MailTransport.of({
    send: (message) => {
      if (transportFailure) {
        return Effect.fail(
          new AppError({ code: "UNAVAILABLE", message: "smtp down" })
        );
      }
      sentMessages.push(message);
      return Effect.succeed("sent" as const);
    },
  })
);
const layer = Layer.provide(EmailNotificationsLive, transportLayer);

const run = <Value>(
  program: (
    service: EmailNotifications["Service"]
  ) => Effect.Effect<Value, AppError>
) =>
  Effect.runPromise(
    Effect.provide(
      Effect.flatMap(Effect.service(EmailNotifications), program),
      layer
    )
  );

const createdUsers: string[] = [];
interface FixtureOptions {
  readonly deactivated?: boolean;
  readonly digest?: boolean;
  readonly emailEvents?: readonly string[];
  readonly mustChangePassword?: boolean;
  readonly role?: "employee" | "admin";
}

const createUser = async (options: FixtureOptions = {}): Promise<string> => {
  const userId = randomUUID();
  createdUsers.push(userId);
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, $5)',
    [
      userId,
      "Asha",
      `${userId}@email-delivery.example`,
      options.role ?? "employee",
      options.mustChangePassword ?? false,
    ]
  );
  if (options.deactivated) {
    await authPool.query(
      'UPDATE "user" SET "deactivatedAt" = now(), "deactivatedById" = $1 WHERE id = $1',
      [userId]
    );
  }
  await authPool.query(
    'INSERT INTO notification_preference (id, "userId", channel, "eventType", enabled) SELECT gen_random_uuid(), $1, \'email\', unnest($2::text[]), true',
    [userId, options.emailEvents ?? ["assignment"]]
  );
  if (options.digest) {
    await authPool.query(
      'INSERT INTO email_setting ("userId", digest) VALUES ($1, true)',
      [userId]
    );
  }
  await authPool.query(
    'INSERT INTO user_preference (id, "userId", key, value) VALUES ($1, $2, \'display\', \'{"timezone":"UTC"}\')',
    [randomUUID(), userId]
  );
  return userId;
};

const notification = (
  userId: string,
  eventType: EmailEventType = "assignment"
) => ({
  body: "Fix the login",
  eventType,
  notificationId: randomUUID(),
  title: "Ravi assigned you a task",
  url: "/tasks/42",
  userId,
});

const addNotification = (
  userId: string,
  type: string,
  text: string,
  createdAt: Date
) =>
  authPool.query(
    'INSERT INTO notification (id, "userId", type, text, snippet, "createdAt") VALUES ($1, $2, $3, $4, $5, $6)',
    [randomUUID(), userId, type, text, "details", createdAt]
  );

afterEach(async () => {
  sentMessages.length = 0;
  transportFailure = false;
  const users = createdUsers.splice(0);
  await authPool.query('DELETE FROM notification WHERE "userId" = ANY($1)', [
    users,
  ]);
  await authPool.query('DELETE FROM "user" WHERE id = ANY($1)', [users]);
});

describe("instant email delivery", () => {
  it("sends one email with an unsubscribe footer and records a receipt", async () => {
    const userId = await createUser();
    const input = notification(userId);

    const result = await run((email) => email.deliverNotification(input));

    expect(result).toBe("sent");
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]?.to).toBe(`${userId}@email-delivery.example`);
    expect(sentMessages[0]?.subject).toBe("Ravi assigned you a task");
    expect(sentMessages[0]?.text).toContain("/api/email/unsubscribe?token=");
    const receipts = await authPool.query(
      'SELECT 1 FROM email_delivery WHERE "userId" = $1',
      [userId]
    );
    expect(receipts.rowCount).toBe(1);
  });

  it("sends a retried or duplicated job only once", async () => {
    const userId = await createUser();
    const input = notification(userId);

    const first = await run((email) => email.deliverNotification(input));
    const second = await run((email) => email.deliverNotification(input));

    expect([first, second]).toEqual(["sent", "skipped"]);
    expect(sentMessages).toHaveLength(1);
  });

  it("does not record a receipt when the provider fails, so a retry can send", async () => {
    const userId = await createUser();
    const input = notification(userId);
    transportFailure = true;

    const failure = await Effect.runPromise(
      Effect.flip(
        Effect.provide(
          Effect.flatMap(Effect.service(EmailNotifications), (email) =>
            email.deliverNotification(input)
          ),
          layer
        )
      )
    );
    transportFailure = false;
    const retry = await run((email) => email.deliverNotification(input));

    expect(failure.code).toBe("UNAVAILABLE");
    expect(retry).toBe("sent");
    expect(sentMessages).toHaveLength(1);
  });

  it("skips people who have not enabled email for the event", async () => {
    const optedOut = await createUser({ emailEvents: [] });
    const otherEvent = await createUser({ emailEvents: ["comment"] });

    const results = await Promise.all([
      run((email) => email.deliverNotification(notification(optedOut))),
      run((email) => email.deliverNotification(notification(otherEvent))),
    ]);

    expect(results).toEqual(["skipped", "skipped"]);
    expect(sentMessages).toHaveLength(0);
  });

  it("skips deactivated accounts, forced password changes and digest users", async () => {
    const deactivated = await createUser({ deactivated: true });
    const mustChange = await createUser({ mustChangePassword: true });
    const digestUser = await createUser({ digest: true });

    const results = await Promise.all(
      [deactivated, mustChange, digestUser].map((userId) =>
        run((email) => email.deliverNotification(notification(userId)))
      )
    );

    expect(results).toEqual(["skipped", "skipped", "skipped"]);
    expect(sentMessages).toHaveLength(0);
  });
});

describe("daily email digest", () => {
  const scheduledAt = new Date("2099-03-14T08:10:00.000Z");

  it("sends one digest of enabled events since the last digest", async () => {
    const userId = await createUser({
      digest: true,
      emailEvents: ["assignment", "comment"],
    });
    const recent = new Date("2099-03-13T12:00:00.000Z");
    await addNotification(userId, "assignment", "Assigned to you", recent);
    await addNotification(userId, "comment", "New comment", recent);
    await addNotification(userId, "update", "Not enabled", recent);
    await addNotification(
      userId,
      "assignment",
      "Too old",
      new Date("2099-03-01T12:00:00.000Z")
    );

    const first = await run((email) => email.sendDigests(scheduledAt));
    const second = await run((email) => email.sendDigests(scheduledAt));

    expect(first.usersEmailed).toBeGreaterThanOrEqual(1);
    expect(second.usersEmailed).toBe(0);
    const digests = sentMessages.filter(
      ({ to }) => to === `${userId}@email-delivery.example`
    );
    expect(digests).toHaveLength(1);
    expect(digests[0]?.subject).toBe("Your Metsys digest: 2 updates");
    expect(digests[0]?.text).toContain("Assigned to you");
    expect(digests[0]?.text).not.toContain("Not enabled");
    expect(digests[0]?.text).not.toContain("Too old");
    const setting = await authPool.query<{ lastDigestAt: Date | null }>(
      'SELECT "lastDigestAt" FROM email_setting WHERE "userId" = $1',
      [userId]
    );
    expect(setting.rows[0]?.lastDigestAt?.toISOString()).toBe(
      scheduledAt.toISOString()
    );
  });

  it("sends nothing outside the local morning hour or without news", async () => {
    const quiet = await createUser({ digest: true });
    const nonDigest = await createUser();
    await addNotification(
      nonDigest,
      "assignment",
      "Assigned",
      new Date("2099-03-13T12:00:00.000Z")
    );

    const wrongHour = await run((email) =>
      email.sendDigests(new Date("2099-03-14T15:00:00.000Z"))
    );
    const noNews = await run((email) => email.sendDigests(scheduledAt));

    expect(wrongHour.usersEmailed).toBe(0);
    expect(sentMessages.filter(({ to }) => to.startsWith(quiet))).toHaveLength(
      0
    );
    expect(
      sentMessages.filter(({ to }) => to.startsWith(nonDigest))
    ).toHaveLength(0);
    expect(noNews.usersEmailed).toBe(0);
  });
});

describe("email settings", () => {
  it("saves the digest option and reports it back", async () => {
    const userId = await createUser();

    const before = await run((email) => email.getSettings(userId));
    await run((email) => email.setDigest(userId, true));
    const after = await run((email) => email.getSettings(userId));

    expect(before).toEqual({ digest: false });
    expect(after).toEqual({ digest: true });
  });

  it("unsubscribes a person from every email in one step", async () => {
    const userId = await createUser({
      digest: true,
      emailEvents: ["assignment", "comment"],
    });

    await run((email) => email.unsubscribe(userId));

    const enabled = await authPool.query(
      "SELECT 1 FROM notification_preference WHERE \"userId\" = $1 AND channel = 'email' AND enabled",
      [userId]
    );
    expect(enabled.rowCount).toBe(0);
    expect(await run((email) => email.getSettings(userId))).toEqual({
      digest: false,
    });
    expect(
      await run((email) => email.deliverNotification(notification(userId)))
    ).toBe("skipped");
  });
});
