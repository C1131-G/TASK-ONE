import { afterAll, beforeAll, beforeEach, expect, it } from "bun:test";

import {
  authPool,
  ids,
  personaBearerToken,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  callRoute,
  seedNotification,
} from "./support/mobile-notifications-fixtures";
import { seedClientBug, seedTask } from "./support/mobile-tasks-fixtures";

interface Item {
  readonly id: string;
}

interface Inbox {
  readonly items: readonly Item[];
  readonly nextCursor: string | null;
  readonly unreadCount: number;
}

let ownBugId = "";
let foreignBugId = "";

beforeAll(async () => {
  await setupHarness();
  const ownTask = await seedTask({
    createdById: personaId("admin"),
    type: "bug",
  });
  ownBugId = await seedClientBug(ownTask, ids.clientCompanyId);
  const foreignTask = await seedTask({
    createdById: personaId("admin"),
    type: "bug",
  });
  foreignBugId = await seedClientBug(foreignTask, ids.otherClientCompanyId);
});
afterAll(teardownHarness);
beforeEach(async () => {
  await authPool.query('DELETE FROM notification WHERE "userId" = $1', [
    personaId("client"),
  ]);
});

const read = async (query: Record<string, string> = {}) => {
  const { GET } =
    await import("../../apps/web/app/api/v1/portal/notifications/route");
  return callRoute<Inbox>(GET, "GET", "/api/v1/portal/notifications", {
    query,
    token: personaBearerToken("client"),
  });
};

const seed = (minutesAgo: number, bugId: string, readAt: Date | null = null) =>
  seedNotification({
    createdAt: new Date(Date.UTC(2026, 9, 1, 12, 0) - minutesAgo * 60_000),
    readAt,
    targetId: bugId,
    targetType: "bug",
    userId: personaId("client"),
  });

const walk = async (limit: number): Promise<string[]> => {
  const seen: string[] = [];
  let cursor: string | undefined;
  do {
    // eslint-disable-next-line no-await-in-loop
    const reply = await read({
      limit: String(limit),
      ...(cursor ? { cursor } : {}),
    });
    expect(reply.status).toBe(200);
    expect(reply.body.data.items.length).toBeLessThanOrEqual(limit);
    seen.push(...reply.body.data.items.map(({ id }) => id));
    cursor = reply.body.data.nextCursor ?? undefined;
  } while (cursor);
  return seen;
};

it("pages the inbox and returns exactly the rows the client can open, once each", async () => {
  const visible: string[] = [];
  for (let index = 0; index < 7; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    visible.push(await seed(index * 2, ownBugId));
    // A row the client cannot open sits between the visible ones.
    // eslint-disable-next-line no-await-in-loop
    await seed(index * 2 + 1, foreignBugId);
  }

  const paged = await walk(2);
  const everything = await walk(100);

  expect(paged).toEqual(visible);
  expect(everything).toEqual(visible);
});

it("keeps rows that share one timestamp, each exactly once", async () => {
  const same = await Promise.all([
    seed(5, ownBugId),
    seed(5, ownBugId),
    seed(5, ownBugId),
  ]);

  const paged = await walk(1);

  expect(paged.toSorted()).toEqual(same.toSorted());
});

it("reports the same unread count on every page", async () => {
  await seed(1, ownBugId);
  await seed(2, ownBugId);
  await seed(3, ownBugId, new Date());
  const first = await read({ limit: "1" });
  const second = await read({
    cursor: first.body.data.nextCursor ?? "",
    limit: "1",
  });

  expect(first.body.data.unreadCount).toBe(2);
  expect(second.body.data.unreadCount).toBe(2);
});

it("gives no cursor when the list fits on one page, and refuses a bad cursor or limit", async () => {
  await seed(1, ownBugId);

  const only = await read({ limit: "5" });
  const badCursor = await read({ cursor: "bm90LWEtY3Vyc29y" });
  const zero = await read({ limit: "0" });
  const huge = await read({ limit: "101" });

  expect(only.body.data.nextCursor).toBeNull();
  expect([badCursor.status, zero.status, huge.status]).toEqual([422, 422, 422]);
});
