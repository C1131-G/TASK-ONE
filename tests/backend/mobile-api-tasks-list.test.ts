import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import { seedTask, send } from "./support/mobile-tasks-fixtures";

interface Row {
  readonly assigneeIds: readonly string[];
  readonly assigneeNames: readonly string[];
  readonly dueDate: string | null;
  readonly id: string;
  readonly priority: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly reference: string;
  readonly status: string;
  readonly title: string;
  readonly version: number;
}

interface Page {
  readonly items: readonly Row[];
  readonly nextCursor: string | null;
}

const BASE = Date.UTC(2026, 9, 1, 12, 0);
const PATH = "/api/v1/workspace/tasks";

beforeAll(setupHarness);
afterAll(teardownHarness);

const seedAt = async (
  minutesAgo: number,
  seed: Parameters<typeof seedTask>[0] = {}
): Promise<string> => {
  const taskId = await seedTask(seed);
  await authPool.query('UPDATE task SET "createdAt" = $2 WHERE id = $1', [
    taskId,
    new Date(BASE - minutesAgo * 60_000),
  ]);
  return taskId;
};

const list = (query: Record<string, string> = {}, as = "outsider" as const) =>
  send<Page>("GET", `${PATH}?${new URLSearchParams(query).toString()}`, {
    as,
  });

const walk = async (
  limit: number,
  extra: Record<string, string> = {}
): Promise<Row[]> => {
  const seen: Row[] = [];
  let cursor: string | undefined;
  do {
    // eslint-disable-next-line no-await-in-loop
    const reply = await list({
      limit: String(limit),
      ...extra,
      ...(cursor ? { cursor } : {}),
    });
    expect(reply.status).toBe(200);
    if (!reply.body.ok) {
      throw new Error("expected a page");
    }
    expect(reply.body.data.items.length).toBeLessThanOrEqual(limit);
    seen.push(...reply.body.data.items);
    cursor = reply.body.data.nextCursor ?? undefined;
  } while (cursor);
  return seen;
};

it("lists tasks newest first with what a row needs, without bugs or archived tasks", async () => {
  const newest = await seedAt(1, {
    assignees: [personaId("outsider")],
    dueDate: "2026-11-02",
    priority: "high",
    status: "progress",
    title: "Newest task",
  });
  const older = await seedAt(30, { title: "Older task" });
  const bug = await seedAt(2, { title: "A bug", type: "bug" });
  const archived = await seedAt(3, { archived: true, title: "Archived" });

  const rows = await walk(50);
  const order = rows.map(({ id }) => id);

  expect(order.indexOf(newest)).toBeLessThan(order.indexOf(older));
  expect(order).not.toContain(bug);
  expect(order).not.toContain(archived);
  const row = rows.find(({ id }) => id === newest);
  expect(row?.title).toBe("Newest task");
  expect(row?.status).toBe("progress");
  expect(row?.priority).toBe("high");
  expect(row?.dueDate).toBe("2026-11-02");
  expect(row?.assigneeIds).toEqual([personaId("outsider")]);
  expect(row?.assigneeNames).toHaveLength(1);
  expect(row?.projectId).toBe(ids.projectId);
  expect(row?.projectName).toBeTruthy();
  expect(row?.reference).toMatch(/^[A-Z0-9]+-\d+$/u);
  expect(row?.version).toBe(1);
});

it("pages with a cursor and returns each task exactly once, even with one timestamp", async () => {
  const same = [
    await seedAt(900, { title: "Same time A" }),
    await seedAt(900, { title: "Same time B" }),
    await seedAt(900, { title: "Same time C" }),
  ];

  const pagedRows = await walk(2);
  const everythingRows = await walk(100);
  const paged = pagedRows.map(({ id }) => id);
  const everything = everythingRows.map(({ id }) => id);

  expect(paged).toEqual(everything);
  expect(new Set(paged).size).toBe(paged.length);
  for (const id of same) {
    expect(paged.filter((seen) => seen === id)).toHaveLength(1);
  }
});

it("filters by status, project and assignee while paging", async () => {
  const todo = await seedAt(40, { status: "todo", title: "Filter todo" });
  const done = await seedAt(41, { status: "done", title: "Filter done" });
  const mine = await seedAt(42, {
    assignees: [personaId("outsider")],
    title: "Filter mine",
  });

  const doneRows = await walk(1, { status: "done" });
  const mineRows = await walk(1, { mine: "true" });
  const onlyDone = doneRows.map(({ id }) => id);
  const onlyMine = mineRows.map(({ id }) => id);
  const noProject = await walk(5, { projectId: randomUUID() });

  expect(onlyDone).toContain(done);
  expect(onlyDone).not.toContain(todo);
  expect(onlyMine).toContain(mine);
  expect(onlyMine).not.toContain(todo);
  expect(noProject).toEqual([]);
});

it("refuses a bad cursor, a bad limit, a bad status and a bad project id", async () => {
  const badCursor = await list({ cursor: "bm90LWEtY3Vyc29y" });
  const zero = await list({ limit: "0" });
  const huge = await list({ limit: "101" });
  const status = await list({ status: "nonsense" });
  const project = await list({ projectId: "not-a-uuid" });

  expect([
    badCursor.status,
    zero.status,
    huge.status,
    status.status,
    project.status,
  ]).toEqual([422, 422, 422, 422, 422]);
});

it("keeps clients out and answers 401 without a session", async () => {
  const client = await send("GET", PATH, { as: "client" });
  const anonymous = await send("GET", PATH, {});

  expect(client.status).toBe(403);
  expect(anonymous.status).toBe(401);
});
