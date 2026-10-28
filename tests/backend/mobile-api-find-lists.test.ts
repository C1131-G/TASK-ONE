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
  readonly id: string;
  readonly kind?: string;
}

interface Page {
  readonly items: readonly Row[];
  readonly nextCursor: string | null;
}

interface Week {
  readonly days: readonly { readonly date: string; readonly minutes: number }[];
  readonly entries: readonly {
    readonly minutes: number;
    readonly taskId: string;
  }[];
  readonly totalMinutes: number;
  readonly weekStart: string;
}

interface Search {
  readonly projects: readonly { readonly id: string }[];
  readonly tasks: readonly { readonly id: string; readonly title: string }[];
}

const WORK_DAY = "2026-10-07";
const NEEDLE = "Zebra-quartz-needle";
let findable = "";
let archivedTask = "";
const standaloneFile = randomUUID();

beforeAll(async () => {
  await setupHarness();
  findable = await seedTask({ title: `${NEEDLE} report` });
  archivedTask = await seedTask({ archived: true, title: "Archived by test" });
  await authPool.query(
    'INSERT INTO time_entry (id, "userId", "taskId", "workDate", minutes, billable) VALUES (gen_random_uuid(), $1, $2, $3, 90, true)',
    [personaId("outsider"), findable, WORK_DAY]
  );
  await authPool.query(
    `INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes")
     VALUES ($1, $2, NULL, $3, 'standalone.txt', $4, 'text/plain', 7)`,
    [
      standaloneFile,
      ids.projectId,
      personaId("admin"),
      `projects/${standaloneFile}/standalone.txt`,
    ]
  );
  await authPool.query(
    'INSERT INTO favorite_project ("userId", "projectId") VALUES ($1, $2)',
    [personaId("outsider"), ids.projectId]
  );
  await authPool.query(
    'INSERT INTO favorite_task ("userId", "taskId") VALUES ($1, $2)',
    [personaId("outsider"), findable]
  );
});
afterAll(teardownHarness);

const walk = async (path: string): Promise<string[]> => {
  const seen: string[] = [];
  let cursor: string | null = null;
  do {
    const joiner = path.includes("?") ? "&" : "?";
    const query = `limit=1${cursor ? `&cursor=${cursor}` : ""}`;
    // eslint-disable-next-line no-await-in-loop
    const reply: Awaited<ReturnType<typeof send<Page>>> = await send<Page>(
      "GET",
      `${path}${joiner}${query}`,
      { as: "outsider" }
    );
    if (!reply.body.ok) {
      throw new Error("expected a page");
    }
    seen.push(...reply.body.data.items.map(({ id, kind }) => `${kind}:${id}`));
    cursor = reply.body.data.nextCursor;
  } while (cursor);
  return seen;
};

it("shows the caller's own time for the week of a day, with totals per day", async () => {
  const reply = await send<Week>(
    "GET",
    `/api/v1/workspace/my-time?date=${WORK_DAY}`,
    { as: "outsider" }
  );

  expect(reply.status).toBe(200);
  if (!reply.body.ok) {
    throw new Error("expected a week");
  }
  const week = reply.body.data;
  expect(week.entries.map(({ taskId }) => taskId)).toContain(findable);
  expect(week.totalMinutes).toBeGreaterThanOrEqual(90);
  expect(week.days.find(({ date }) => date === WORK_DAY)?.minutes).toBe(90);
  expect(week.weekStart <= WORK_DAY).toBe(true);
});

it("does not show another person's time", async () => {
  const reply = await send<Week>(
    "GET",
    `/api/v1/workspace/my-time?date=${WORK_DAY}`,
    { as: "admin" }
  );

  expect(reply.status).toBe(200);
  if (!reply.body.ok) {
    throw new Error("expected a week");
  }
  expect(reply.body.data.entries.map(({ taskId }) => taskId)).not.toContain(
    findable
  );
});

it("refuses a date that is not a calendar day", async () => {
  const reply = await send("GET", "/api/v1/workspace/my-time?date=tomorrow", {
    as: "outsider",
  });

  expect(reply.status).toBe(422);
});

it("finds a task by its name, and requires some text", async () => {
  const found = await send<Search>(
    "GET",
    `/api/v1/workspace/search?q=${NEEDLE}`,
    { as: "outsider" }
  );
  const empty = await send("GET", "/api/v1/workspace/search?q=", {
    as: "outsider",
  });
  const missing = await send("GET", "/api/v1/workspace/search", {
    as: "outsider",
  });

  expect(found.status).toBe(200);
  if (!found.body.ok) {
    throw new Error("expected results");
  }
  expect(found.body.data.tasks.map(({ id }) => id)).toContain(findable);
  expect([empty.status, missing.status]).toEqual([422, 422]);
});

it("lists the caller's favorites, projects first, and pages them", async () => {
  const paged = await walk("/api/v1/workspace/favorites");

  expect(paged).toContain(`project:${ids.projectId}`);
  expect(paged).toContain(`task:${findable}`);
  expect(paged.indexOf(`project:${ids.projectId}`)).toBeLessThan(
    paged.indexOf(`task:${findable}`)
  );
  expect(new Set(paged).size).toBe(paged.length);
});

it("lists archived work, newest first, and pages it", async () => {
  const paged = await walk("/api/v1/workspace/archive");

  expect(paged).toContain(`task:${archivedTask}`);
  expect(paged).toContain(`project:${ids.archivedProjectId}`);
  expect(new Set(paged).size).toBe(paged.length);
});

it("lists the standalone files for an admin, and shows nothing to staff who may not open them", async () => {
  const one = await send<Page>(
    "GET",
    `/api/v1/workspace/files?projectId=${ids.projectId}`,
    { as: "admin" }
  );
  const all = await send<Page>("GET", "/api/v1/workspace/files", {
    as: "admin",
  });
  const staffAll = await send<Page>("GET", "/api/v1/workspace/files", {
    as: "outsider",
  });
  const staffOne = await send(
    "GET",
    `/api/v1/workspace/files?projectId=${ids.projectId}`,
    { as: "outsider" }
  );

  expect([one.status, all.status, staffAll.status, staffOne.status]).toEqual([
    200, 200, 200, 403,
  ]);
  if (!one.body.ok || !all.body.ok || !staffAll.body.ok) {
    throw new Error("expected pages");
  }
  expect(one.body.data.items.map(({ id }) => id)).toContain(standaloneFile);
  expect(all.body.data.items.map(({ id }) => id)).toContain(standaloneFile);
  expect(staffAll.body.data.items).toEqual([]);
});

it("keeps clients out, answers 401 without a session, and refuses bad input", async () => {
  const paths = [
    "/api/v1/workspace/my-time",
    "/api/v1/workspace/search?q=x",
    "/api/v1/workspace/favorites",
    "/api/v1/workspace/archive",
    "/api/v1/workspace/files",
  ];
  for (const path of paths) {
    // eslint-disable-next-line no-await-in-loop
    const client = await send("GET", path, { as: "client" });
    // eslint-disable-next-line no-await-in-loop
    const anonymous = await send("GET", path, {});

    expect([client.status, anonymous.status]).toEqual([403, 401]);
  }
  const badCursor = await send(
    "GET",
    "/api/v1/workspace/archive?cursor=bm90LWEtY3Vyc29y",
    { as: "outsider" }
  );
  const badProject = await send(
    "GET",
    "/api/v1/workspace/files?projectId=nope",
    { as: "outsider" }
  );

  expect([badCursor.status, badProject.status]).toEqual([422, 422]);
});
