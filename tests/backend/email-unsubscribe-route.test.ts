import { expect, it, mock } from "bun:test";
import { randomUUID } from "node:crypto";

import { authPool } from "../../src/server/auth/database";
import { signUnsubscribeToken } from "../../src/server/email/unsubscribe-token";

// `connection()` only opts the route out of prerendering and throws outside a
// Next.js request scope.
mock.module("next/server", () => ({ connection: () => Promise.resolve() }));

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";
const secret = process.env["BETTER_AUTH_SECRET"];

const urlFor = (token: string) =>
  `http://localhost:3000/api/email/unsubscribe?token=${encodeURIComponent(token)}`;

const createSubscribedUser = async (): Promise<string> => {
  const userId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [userId, "Unsubscribe", `${userId}@unsubscribe-route.example`]
  );
  await authPool.query(
    "INSERT INTO notification_preference (id, \"userId\", channel, \"eventType\", enabled) VALUES ($1, $2, 'email', 'comment', true)",
    [randomUUID(), userId]
  );
  await authPool.query(
    'INSERT INTO email_setting ("userId", digest) VALUES ($1, true)',
    [userId]
  );
  return userId;
};

const subscriptionCount = async (userId: string): Promise<number> => {
  const result = await authPool.query<{ count: number }>(
    'SELECT (SELECT count(*) FROM notification_preference WHERE "userId" = $1 AND channel = \'email\' AND enabled)::int + (SELECT count(*) FROM email_setting WHERE "userId" = $1 AND digest)::int AS count',
    [userId]
  );
  return result.rows[0]?.count ?? 0;
};

const cleanUp = async (userId: string) => {
  await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
};

it("shows a confirmation page on GET without changing anything", async () => {
  const userId = await createSubscribedUser();
  try {
    const { GET } =
      await import("../../apps/web/app/api/email/unsubscribe/route");
    const response = await GET(
      new Request(urlFor(signUnsubscribeToken(userId, secret ?? "")))
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toContain("<form");
    expect(await subscriptionCount(userId)).toBe(2);
  } finally {
    await cleanUp(userId);
  }
});

it("turns off every email on POST, including the one-click mail client form", async () => {
  const userId = await createSubscribedUser();
  try {
    const { POST } =
      await import("../../apps/web/app/api/email/unsubscribe/route");
    const response = await POST(
      new Request(urlFor(signUnsubscribeToken(userId, secret ?? "")), {
        body: "List-Unsubscribe=One-Click",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
      })
    );

    expect(response.status).toBe(200);
    expect(await subscriptionCount(userId)).toBe(0);
  } finally {
    await cleanUp(userId);
  }
});

it("rejects a forged or missing token without changing anything", async () => {
  const userId = await createSubscribedUser();
  try {
    const { GET, POST } =
      await import("../../apps/web/app/api/email/unsubscribe/route");
    const forged = signUnsubscribeToken(
      userId,
      "another-secret-entirely-different"
    );
    const responses = await Promise.all([
      POST(new Request(urlFor(forged), { method: "POST" })),
      POST(
        new Request("http://localhost:3000/api/email/unsubscribe", {
          method: "POST",
        })
      ),
      GET(new Request(urlFor("garbage"))),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([400, 400, 400]);
    expect(await subscriptionCount(userId)).toBe(2);
  } finally {
    await cleanUp(userId);
  }
});
