import { afterEach, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { db } from "../../src/prisma/db";
import { authPool } from "../../src/server/auth/database";
import { notifyUsers } from "../../src/server/notifications/notify-users";
import type { NotificationEventType } from "../../src/server/notifications/notify-users";

const createdUsers: string[] = [];

const createUser = async (setup: {
  readonly emailEvents?: readonly string[];
  readonly digest?: boolean;
}): Promise<string> => {
  const userId = randomUUID();
  createdUsers.push(userId);
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [userId, "Notify", `${userId}@notify-email.example`]
  );
  await authPool.query(
    'INSERT INTO notification_preference (id, "userId", channel, "eventType", enabled) SELECT gen_random_uuid(), $1, \'email\', unnest($2::text[]), true',
    [userId, setup.emailEvents ?? []]
  );
  if (setup.digest) {
    await authPool.query(
      'INSERT INTO email_setting ("userId", digest) VALUES ($1, true)',
      [userId]
    );
  }
  return userId;
};

const notify = (recipientIds: string[], type: NotificationEventType) =>
  db.transaction((transaction) =>
    notifyUsers(transaction, {
      actorId: null,
      now: new Date(),
      projectId: null,
      recipientIds,
      snippet: "Details",
      taskId: null,
      text: "Something happened",
      type,
      url: "/tasks/1",
    })
  );

const emailJobsFor = async (userIds: readonly string[]) => {
  const result = await authPool.query<{
    dedupeKey: string;
    payload: { userId: string; eventType: string; url: string };
  }>(
    "SELECT \"dedupeKey\", payload FROM job WHERE kind = 'notifications.deliver-email' AND payload->>'userId' = ANY($1)",
    [userIds]
  );
  return result.rows;
};

afterEach(async () => {
  const users = createdUsers.splice(0);
  await authPool.query("DELETE FROM job WHERE payload->>'userId' = ANY($1)", [
    users,
  ]);
  await authPool.query('DELETE FROM notification WHERE "userId" = ANY($1)', [
    users,
  ]);
  await authPool.query('DELETE FROM "user" WHERE id = ANY($1)', [users]);
});

it("queues one idempotent email job for people who opted in to the event", async () => {
  const optedIn = await createUser({ emailEvents: ["assignment"] });
  const optedOut = await createUser({});
  const otherEvent = await createUser({ emailEvents: ["comment"] });

  await notify([optedIn, optedOut, otherEvent], "assignment");

  const jobs = await emailJobsFor([optedIn, optedOut, otherEvent]);
  expect(jobs).toHaveLength(1);
  expect(jobs[0]?.payload).toMatchObject({
    eventType: "assignment",
    url: "/tasks/1",
    userId: optedIn,
  });
  expect(jobs[0]?.dedupeKey).toStartWith("email:");
});

it("leaves digest subscribers to the daily digest", async () => {
  const digestUser = await createUser({
    digest: true,
    emailEvents: ["assignment"],
  });

  await notify([digestUser], "assignment");

  expect(await emailJobsFor([digestUser])).toHaveLength(0);
});

it("never queues email for events that cannot be emailed", async () => {
  const user = await createUser({ emailEvents: ["due"] });

  await notify([user], "due");

  expect(await emailJobsFor([user])).toHaveLength(0);
});
