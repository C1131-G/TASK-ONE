import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
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

const PATH = "/api/v1/workspace/notifications/preferences";

const read = async (persona: "owner" | "outsider" | "client") => {
  const { GET } =
    await import("../../app/api/v1/workspace/notifications/preferences/route");
  return callRoute<{ preferences: Preference[] }>(GET, "GET", PATH, {
    token: personaBearerToken(persona),
  });
};

const update = async (
  persona: "owner" | "outsider" | "client",
  body: unknown,
  key?: string
) => {
  const { PATCH } =
    await import("../../app/api/v1/workspace/notifications/preferences/route");
  return callRoute<{ done: true }>(PATCH, "PATCH", PATH, {
    body,
    ...(key ? { key } : {}),
    token: personaBearerToken(persona),
  });
};

const storedPreferences = async (userId: string): Promise<Preference[]> => {
  const result = await authPool.query<Preference>(
    'SELECT channel, "eventType", enabled FROM notification_preference WHERE "userId" = $1 ORDER BY channel, "eventType"',
    [userId]
  );
  return result.rows;
};

it("turns a kind of notification off for the caller only, and a retry changes nothing", async () => {
  const key = `pref-${randomUUID()}`;
  const body = { channel: "in-app", enabled: false, eventType: "mention" };

  const first = await update("owner", body, key);
  const retry = await update("owner", body, key);
  const mine = await read("owner");
  const theirs = await read("outsider");

  expect(first.status).toBe(200);
  expect(retry.body.data).toEqual({ done: true });
  expect(mine.body.data.preferences).toContainEqual(body);
  expect(theirs.body.data.preferences).not.toContainEqual(body);
  expect(await storedPreferences(personaId("owner"))).toEqual([body]);
});

it("refuses an email preference for a kind that has no email, and stores nothing", async () => {
  const before = await storedPreferences(personaId("outsider"));

  const reply = await update("outsider", {
    channel: "email",
    enabled: true,
    eventType: "due",
  });

  expect(reply.status).toBe(422);
  expect(await storedPreferences(personaId("outsider"))).toEqual(before);
});

it("refuses an unknown channel or kind, and a write without a key", async () => {
  const badChannel = await update("owner", {
    channel: "carrier-pigeon",
    enabled: true,
    eventType: "mention",
  });
  const noKey = await (async () => {
    const { PATCH } =
      await import("../../app/api/v1/workspace/notifications/preferences/route");
    return callRoute(PATCH, "PATCH", PATH, {
      body: { channel: "in-app", enabled: false, eventType: "due" },
      key: null,
      token: personaBearerToken("owner"),
    });
  })();

  expect(badChannel.status).toBe(422);
  expect(noKey.status).toBe(422);
  const stored = await storedPreferences(personaId("owner"));
  expect(stored.map(({ eventType }) => eventType)).toEqual(["mention"]);
});

it("keeps staff preferences away from a client token", async () => {
  const reply = await read("client");

  expect(reply.status).toBe(403);
});
