import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  personaBearerToken,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  callRoute,
  notificationRows,
  seedNotification,
} from "./support/mobile-notifications-fixtures";

beforeAll(setupHarness);
afterAll(teardownHarness);

const markRead = async (
  persona: "owner" | "outsider" | "client",
  id: string,
  key?: string | null
) => {
  const { POST } =
    await import("../../app/api/v1/workspace/notifications/[id]/read/route");
  return callRoute<{ done: true }>(
    POST,
    "POST",
    `/api/v1/workspace/notifications/${id}/read`,
    {
      ...(key === undefined ? {} : { key }),
      params: { id },
      token: personaBearerToken(persona),
    }
  );
};

const markAllRead = async (
  persona: "owner" | "outsider" | "client",
  key?: string
) => {
  const { POST } =
    await import("../../app/api/v1/workspace/notifications/read-all/route");
  return callRoute<{ count: number }>(
    POST,
    "POST",
    "/api/v1/workspace/notifications/read-all",
    { ...(key ? { key } : {}), token: personaBearerToken(persona) }
  );
};

const readAt = async (id: string): Promise<Date | null> => {
  const result = await authPool.query<{ readAt: Date | null }>(
    'SELECT "readAt" FROM notification WHERE id = $1',
    [id]
  );
  return result.rows[0]?.readAt ?? null;
};

it("marks the caller's notification read and keeps the first read time on a retry", async () => {
  const id = await seedNotification({ userId: personaId("owner") });
  const key = `read-${randomUUID()}`;

  const first = await markRead("owner", id, key);
  const firstReadAt = await readAt(id);
  const retry = await markRead("owner", id, key);
  const again = await markRead("owner", id);

  expect(first.status).toBe(200);
  expect(first.body.data).toEqual({ done: true });
  expect(firstReadAt).not.toBeNull();
  expect(retry.body.data).toEqual({ done: true });
  expect(again.status).toBe(200);
  const afterRetries = await readAt(id);
  expect(afterRetries?.getTime()).toBe(firstReadAt?.getTime());
});

it("refuses to mark another person's notification, and changes nothing", async () => {
  const id = await seedNotification({ userId: personaId("outsider") });

  const reply = await markRead("owner", id);

  expect(reply.status).toBe(404);
  expect(reply.body.error.code).toBe("NOT_FOUND");
  expect(await readAt(id)).toBeNull();
});

it("refuses a write without an idempotency key, and changes nothing", async () => {
  const id = await seedNotification({ userId: personaId("owner") });

  const reply = await markRead("owner", id, null);

  expect(reply.status).toBe(422);
  expect(await readAt(id)).toBeNull();
});

it("marks every notification of the caller read and leaves other people's alone", async () => {
  const owner = personaId("owner");
  const mine = await Promise.all([
    seedNotification({ userId: owner }),
    seedNotification({ userId: owner }),
  ]);
  const theirs = await seedNotification({ userId: personaId("outsider") });
  const key = `all-${randomUUID()}`;

  const first = await markAllRead("owner", key);
  const retry = await markAllRead("owner", key);

  expect(first.status).toBe(200);
  expect(first.body.data.count).toBeGreaterThanOrEqual(2);
  expect(retry.body.data).toEqual(first.body.data);
  const mineAfter = await Promise.all(mine.map((id) => readAt(id)));
  expect(mineAfter.every((value) => value !== null)).toBe(true);
  expect(await readAt(theirs)).toBeNull();
  const ownerRows = await notificationRows(owner);
  expect(ownerRows.every((row) => row.readAt)).toBe(true);
});

it("answers 401 without a usable token and 403 for a client token", async () => {
  const id = await seedNotification({ userId: personaId("owner") });
  const { POST } =
    await import("../../app/api/v1/workspace/notifications/[id]/read/route");
  const anonymous = await callRoute(
    POST,
    "POST",
    `/api/v1/workspace/notifications/${id}/read`,
    { params: { id } }
  );
  const client = await markRead("client", id);

  expect(anonymous.status).toBe(401);
  expect(client.status).toBe(403);
  expect(await readAt(id)).toBeNull();
});
