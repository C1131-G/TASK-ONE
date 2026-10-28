import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import { seedTask, send } from "./support/mobile-tasks-fixtures";

interface Entry {
  readonly action: string;
  readonly actorName: string;
  readonly createdAt: string;
  readonly id: string;
}

interface Page {
  readonly items: readonly Entry[];
  readonly nextCursor: string | null;
}

interface Workload {
  readonly capacityHours: number;
  readonly people: readonly {
    readonly name: string;
    readonly userId: string;
    readonly weeks: readonly { readonly taskCount: number }[];
  }[];
  readonly weeks: readonly string[];
}

beforeAll(async () => {
  await setupHarness();
  const taskId = await seedTask({ assignees: [personaId("outsider")] });
  await authPool.query(
    `INSERT INTO activity (id, "taskId", "projectId", "actorId", action, details)
     VALUES (gen_random_uuid(), $1, $2, $3, 'task_created', '{}'::jsonb)`,
    [taskId, ids.projectId, personaId("admin")]
  );
});
afterAll(teardownHarness);

it("lists the recent activity with who did what, newest first", async () => {
  const reply = await send<Page>("GET", "/api/v1/workspace/activity", {
    as: "outsider",
  });

  expect(reply.status).toBe(200);
  if (!reply.body.ok) {
    throw new Error("expected a page");
  }
  const { items } = reply.body.data;
  expect(items.length).toBeGreaterThan(0);
  expect(items[0]?.actorName).toBeTruthy();
  const times = items.map(({ createdAt }) => createdAt);
  expect(times).toEqual(times.toSorted().toReversed());
});

it("pages the activity without repeating an entry", async () => {
  const seen: string[] = [];
  let cursor: string | null = null;
  do {
    const query = `limit=1${cursor ? `&cursor=${cursor}` : ""}`;
    // eslint-disable-next-line no-await-in-loop
    const reply: Awaited<ReturnType<typeof send<Page>>> = await send<Page>(
      "GET",
      `/api/v1/workspace/activity?${query}`,
      { as: "admin" }
    );
    if (!reply.body.ok) {
      throw new Error("expected a page");
    }
    seen.push(...reply.body.data.items.map(({ id }) => id));
    cursor = reply.body.data.nextCursor;
  } while (cursor);

  expect(seen.length).toBeGreaterThan(0);
  expect(new Set(seen).size).toBe(seen.length);
});

it("shows each person's open work over the coming weeks", async () => {
  const reply = await send<Workload>("GET", "/api/v1/workspace/workload", {
    as: "admin",
  });

  expect(reply.status).toBe(200);
  if (!reply.body.ok) {
    throw new Error("expected a workload");
  }
  const { capacityHours, people, weeks } = reply.body.data;
  expect(capacityHours).toBeGreaterThan(0);
  expect(weeks.length).toBeGreaterThan(0);
  const person = people.find(({ userId }) => userId === personaId("outsider"));
  expect(person?.name).toBeTruthy();
  expect(person?.weeks).toHaveLength(weeks.length);
});

it("keeps clients out and answers 401 without a session", async () => {
  for (const path of [
    "/api/v1/workspace/activity",
    "/api/v1/workspace/workload",
  ]) {
    // eslint-disable-next-line no-await-in-loop
    const client = await send("GET", path, { as: "client" });
    // eslint-disable-next-line no-await-in-loop
    const anonymous = await send("GET", path, {});

    expect([client.status, anonymous.status]).toEqual([403, 401]);
  }
});

it("refuses a bad cursor", async () => {
  const reply = await send(
    "GET",
    "/api/v1/workspace/activity?cursor=bm90LWEtY3Vyc29y",
    { as: "admin" }
  );

  expect(reply.status).toBe(422);
});
