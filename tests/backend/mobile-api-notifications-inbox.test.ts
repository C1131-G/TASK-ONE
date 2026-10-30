import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  authPool,
  personaBearerToken,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  callRoute,
  seedNotification,
} from "./support/mobile-notifications-fixtures";

beforeAll(setupHarness);
afterAll(teardownHarness);

interface InboxData {
  items: { id: string; readAt: string | null; text: string }[];
  nextCursor: string | null;
  unreadCount: number;
}

const inbox = async (
  persona: "owner" | "outsider" | "client",
  query: Record<string, string> = {}
) => {
  const { GET } =
    await import("../../apps/web/app/api/v1/workspace/notifications/route");
  return callRoute<InboxData>(GET, "GET", "/api/v1/workspace/notifications", {
    query,
    token: personaBearerToken(persona),
  });
};

it("lists only the caller's notifications, newest first, with the unread count", async () => {
  const owner = personaId("owner");
  const old = await seedNotification({
    createdAt: new Date("2026-01-01T10:00:00Z"),
    text: "Old",
    userId: owner,
  });
  const recent = await seedNotification({
    createdAt: new Date("2026-01-02T10:00:00Z"),
    readAt: new Date("2026-01-02T11:00:00Z"),
    text: "Recent",
    userId: owner,
  });
  await seedNotification({
    text: "Someone else's",
    userId: personaId("outsider"),
  });

  const reply = await inbox("owner");

  expect(reply.status).toBe(200);
  expect(reply.body.data.items.map(({ id }) => id)).toEqual([recent, old]);
  expect(reply.body.data.unreadCount).toBe(1);
  expect(reply.body.data.nextCursor).toBeNull();
  await authPool.query('DELETE FROM notification WHERE "userId" = $1', [owner]);
});

const collect = async (
  cursor: string | null,
  seen: string[],
  pages: number
): Promise<{ pages: number; seen: string[] }> => {
  const reply = await inbox("owner", {
    limit: "2",
    ...(cursor ? { cursor } : {}),
  });
  expect(reply.status).toBe(200);
  expect(reply.body.data.items.length).toBeLessThanOrEqual(2);
  const next = [...seen, ...reply.body.data.items.map(({ id }) => id)];
  return reply.body.data.nextCursor && pages < 10
    ? collect(reply.body.data.nextCursor, next, pages + 1)
    : { pages: pages + 1, seen: next };
};

it("pages through notifications that share a timestamp without repeating or skipping one", async () => {
  const owner = personaId("owner");
  const sameInstant = new Date("2026-02-01T09:00:00Z");
  const ids = await Promise.all(
    Array.from({ length: 5 }, () =>
      seedNotification({ createdAt: sameInstant, userId: owner })
    )
  );

  const { pages, seen } = await collect(null, [], 0);

  expect(pages).toBe(3);
  expect(seen.toSorted()).toEqual(ids.toSorted());
  expect(new Set(seen).size).toBe(5);
  await authPool.query('DELETE FROM notification WHERE "userId" = $1', [owner]);
});

it("returns only unread notifications when asked", async () => {
  const owner = personaId("owner");
  const unread = await seedNotification({ userId: owner });
  await seedNotification({ readAt: new Date(), userId: owner });

  const reply = await inbox("owner", { unreadOnly: "true" });

  expect(reply.body.data.items.map(({ id }) => id)).toEqual([unread]);
  await authPool.query('DELETE FROM notification WHERE "userId" = $1', [owner]);
});

it("refuses a page size outside 1 to 100 and a cursor it did not issue", async () => {
  const tooMany = await inbox("owner", { limit: "101" });
  const none = await inbox("owner", { limit: "0" });
  const forged = await inbox("owner", { cursor: "not-a-cursor" });

  expect(tooMany.status).toBe(422);
  expect(none.status).toBe(422);
  expect(forged.status).toBe(422);
  expect(forged.body.error.code).toBe("VALIDATION_FAILED");
});

it("refuses a missing token, and a client token on the workspace route", async () => {
  const { GET } =
    await import("../../apps/web/app/api/v1/workspace/notifications/route");
  const anonymous = await callRoute(
    GET,
    "GET",
    "/api/v1/workspace/notifications"
  );
  const client = await inbox("client");

  expect(anonymous.status).toBe(401);
  expect(client.status).toBe(403);
});
