import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  createPersona,
  ids,
  personaBearerToken,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import { callRoute } from "./support/mobile-notifications-fixtures";

beforeAll(setupHarness);
afterAll(teardownHarness);

interface Preference {
  channel: string;
  enabled: boolean;
  eventType: string;
}

const PATH = "/api/v1/portal/notifications/preferences";

const read = async (token: string) => {
  const { GET } =
    await import("../../app/api/v1/portal/notifications/preferences/route");
  return callRoute<{ preferences: Preference[] }>(GET, "GET", PATH, { token });
};

const update = async (token: string, body: unknown, key?: string | null) => {
  const { PATCH } =
    await import("../../app/api/v1/portal/notifications/preferences/route");
  return callRoute<{ done: true }>(PATCH, "PATCH", PATH, {
    body,
    ...(key === undefined ? {} : { key }),
    token,
  });
};

const storedPreferences = async (userId: string): Promise<Preference[]> => {
  const result = await authPool.query<Preference>(
    'SELECT channel, "eventType", enabled FROM notification_preference WHERE "userId" = $1 ORDER BY channel, "eventType"',
    [userId]
  );
  return result.rows;
};

const storedKeys = async (userId: string): Promise<number> => {
  const result = await authPool.query<{ count: string }>(
    'SELECT count(*) FROM idempotency_key WHERE "actorId" = $1',
    [userId]
  );
  return Number(result.rows[0]?.count ?? 0);
};

const freshClient = async () => {
  const persona = await createPersona("employee", `pref-${randomUUID()}`);
  await authPool.query(
    'UPDATE "user" SET role = \'client\', "clientCompanyId" = $2, "mustChangePassword" = false WHERE id = $1',
    [persona.id, ids.clientCompanyId]
  );
  return persona;
};

it("turns a kind of notification off for the client only, and a retry with the same key changes nothing twice", async () => {
  const client = await freshClient();
  const key = `pref-${randomUUID()}`;
  const body = { channel: "in-app", enabled: false, eventType: "status" };

  const first = await update(client.bearerToken, body, key);
  const retry = await update(client.bearerToken, body, key);
  const mine = await read(client.bearerToken);
  const colleague = await read(personaBearerToken("coworker"));

  expect(first.status).toBe(200);
  expect(retry.status).toBe(200);
  expect(retry.body.data).toEqual({ done: true });
  expect(mine.body.data.preferences).toEqual([body]);
  expect(colleague.body.data.preferences).not.toContainEqual(body);
  expect(await storedPreferences(client.id)).toEqual([body]);
});

it("switches a kind back on and keeps browser notifications as its own channel", async () => {
  const client = await freshClient();

  await update(client.bearerToken, {
    channel: "web-push",
    enabled: false,
    eventType: "comment",
  });
  await update(client.bearerToken, {
    channel: "web-push",
    enabled: true,
    eventType: "comment",
  });

  expect(await storedPreferences(client.id)).toEqual([
    { channel: "web-push", enabled: true, eventType: "comment" },
  ]);
});

it("lists only the kinds a client can receive", async () => {
  const client = await freshClient();
  await authPool.query(
    "INSERT INTO notification_preference (id, \"userId\", channel, \"eventType\", enabled, \"updatedAt\") VALUES ($1, $2, 'in-app', 'mention', false, now()), ($3, $2, 'in-app', 'comment', false, now())",
    [randomUUID(), client.id, randomUUID()]
  );

  const reply = await read(client.bearerToken);

  expect(reply.status).toBe(200);
  expect(reply.body.data.preferences).toEqual([
    { channel: "in-app", enabled: false, eventType: "comment" },
  ]);
});

it("refuses a kind only staff receive with the field named, and stores nothing", async () => {
  const client = await freshClient();

  const replies = await Promise.all(
    ["mention", "assignment", "due", "update", "nonsense"].map((eventType) =>
      update(client.bearerToken, {
        channel: "in-app",
        enabled: false,
        eventType,
      })
    )
  );

  for (const reply of replies) {
    expect(reply.status).toBe(422);
    expect(reply.body.error).toMatchObject({
      code: "VALIDATION_FAILED",
      fieldErrors: { eventType: expect.any(String) },
    });
  }
  expect(await storedPreferences(client.id)).toEqual([]);
  expect(await storedKeys(client.id)).toBe(0);
});

it("refuses an unknown channel and a write without a key, and stores nothing", async () => {
  const client = await freshClient();

  const channel = await update(client.bearerToken, {
    channel: "carrier-pigeon",
    enabled: true,
    eventType: "status",
  });
  const noKey = await update(
    client.bearerToken,
    { channel: "in-app", enabled: false, eventType: "status" },
    null
  );

  expect(channel.status).toBe(422);
  expect(noKey.status).toBe(422);
  expect(await storedPreferences(client.id)).toEqual([]);
});

it("refuses the same key with a different body, and keeps the first answer", async () => {
  const client = await freshClient();
  const key = `pref-${randomUUID()}`;
  await update(
    client.bearerToken,
    { channel: "in-app", enabled: false, eventType: "status" },
    key
  );
  const before = await storedPreferences(client.id);

  const reused = await update(
    client.bearerToken,
    { channel: "in-app", enabled: true, eventType: "status" },
    key
  );

  expect(reused.status).toBe(409);
  expect(await storedPreferences(client.id)).toEqual(before);
});

it("keeps client preferences away from a staff token, a missing token and a revoked token", async () => {
  const revoked = await freshClient();
  await authPool.query('DELETE FROM session WHERE "userId" = $1', [revoked.id]);
  const body = { channel: "in-app", enabled: false, eventType: "status" };
  const before = await storedPreferences(personaId("owner"));

  const staffRead = await read(personaBearerToken("owner"));
  const staffWrite = await update(personaBearerToken("owner"), body);
  const anonymousRead = await read("");
  const anonymousWrite = await update("", body);
  const revokedRead = await read(revoked.bearerToken);
  const revokedWrite = await update(revoked.bearerToken, body);

  expect(staffRead.status).toBe(403);
  expect(staffWrite.status).toBe(403);
  expect(anonymousRead.status).toBe(401);
  expect(anonymousWrite.status).toBe(401);
  expect(revokedRead.status).toBe(401);
  expect(revokedWrite.status).toBe(401);
  expect(await storedPreferences(personaId("owner"))).toEqual(before);
});
