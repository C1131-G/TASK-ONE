import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  authPool,
  ids,
  personaBearerToken,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import { callRoute } from "./support/mobile-notifications-fixtures";
import { seedClientBug, seedTask } from "./support/mobile-tasks-fixtures";

interface Row {
  readonly id: string;
}

interface Page {
  readonly items: readonly Row[];
  readonly nextCursor: string | null;
}

beforeAll(setupHarness);
afterAll(teardownHarness);

const BASE = Date.UTC(2026, 9, 1, 12, 0);

const seedBug = async (
  minutesAgo: number,
  options: { company?: string; archived?: boolean } = {}
): Promise<string> => {
  const taskId = await seedTask({
    archived: options.archived ?? false,
    createdById: personaId("admin"),
    type: "bug",
  });
  const bugId = await seedClientBug(
    taskId,
    options.company ?? ids.clientCompanyId
  );
  await authPool.query(
    'UPDATE bug_report SET "discoveredAt" = $2 WHERE id = $1',
    [bugId, new Date(BASE - minutesAgo * 60_000)]
  );
  return bugId;
};

const legacy = async (): Promise<string[]> => {
  const { GET } = await import("../../app/api/v1/portal/bugs/route");
  const reply = await callRoute<readonly Row[]>(
    GET,
    "GET",
    "/api/v1/portal/bugs",
    { token: personaBearerToken("client") }
  );
  return reply.body.data.map(({ id }) => id);
};

const page = async (query: Record<string, string>) => {
  const { GET } = await import("../../app/api/v1/portal/bug-reports/route");
  return callRoute<Page>(GET, "GET", "/api/v1/portal/bug-reports", {
    query,
    token: personaBearerToken("client"),
  });
};

const walk = async (
  limit: number,
  extra: Record<string, string> = {}
): Promise<string[]> => {
  const seen: string[] = [];
  let cursor: string | undefined;
  do {
    // eslint-disable-next-line no-await-in-loop
    const reply = await page({
      limit: String(limit),
      ...extra,
      ...(cursor ? { cursor } : {}),
    });
    expect(reply.status).toBe(200);
    expect(reply.body.data.items.length).toBeLessThanOrEqual(limit);
    seen.push(...reply.body.data.items.map(({ id }) => id));
    cursor = reply.body.data.nextCursor ?? undefined;
  } while (cursor);
  return seen;
};

it("pages the company's bugs and returns what the unpaged list returns, in the same order", async () => {
  for (let index = 0; index < 7; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await seedBug(index * 3);
  }
  // Not the company's, and archived: neither may appear on any page.
  const foreign = await seedBug(1, { company: ids.otherClientCompanyId });
  const archived = await seedBug(2, { archived: true });

  const unpaged = await legacy();
  const paged = await walk(2);

  expect(paged).toEqual(unpaged);
  expect(paged.length).toBeGreaterThanOrEqual(7);
  expect(paged).not.toContain(foreign);
  expect(paged).not.toContain(archived);
});

it("keeps bugs that share one timestamp, each exactly once", async () => {
  const same = [await seedBug(500), await seedBug(500), await seedBug(500)];

  const paged = await walk(1);

  for (const id of same) {
    expect(paged.filter((seen) => seen === id)).toHaveLength(1);
  }
  expect(new Set(paged).size).toBe(paged.length);
});

it("keeps the filters while paging", async () => {
  const mine = await walk(2, { mine: "true" });
  const all = await walk(2);

  expect(mine.every((id) => all.includes(id))).toBe(true);
});

it("gives no cursor when the list fits, and refuses a bad cursor or limit", async () => {
  const everything = await page({ limit: "100" });
  const badCursor = await page({ cursor: "bm90LWEtY3Vyc29y" });
  const zero = await page({ limit: "0" });
  const huge = await page({ limit: "101" });

  expect(everything.status).toBe(200);
  expect([badCursor.status, zero.status, huge.status]).toEqual([422, 422, 422]);
});

it("marks the old list as the capped one", async () => {
  const { portalBugRoutes } = await import("../../src/mobile-api/routes-bugs");

  expect(portalBugRoutes.list.summary).toContain("Deprecated");
  expect(portalBugRoutes.page.operationId).toBe("listPortalBugPage");
});
