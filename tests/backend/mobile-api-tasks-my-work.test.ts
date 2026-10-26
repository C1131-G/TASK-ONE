import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import { isoDay, seedTask, send } from "./support/mobile-tasks-fixtures";

interface WorkItem {
  readonly id: string;
  readonly title: string;
  readonly dueDate: string | null;
  readonly isOverdue: boolean;
  readonly version: number;
}
interface Work {
  readonly items: readonly WorkItem[];
  readonly nextOffset: number | null;
}

const taskIds: Record<string, string> = {};

beforeAll(async () => {
  await setupHarness();
  const me = personaId("outsider");
  taskIds["overdue"] = await seedTask({
    assignees: [me],
    dueDate: isoDay(-3),
    title: "Overdue",
  });
  taskIds["today"] = await seedTask({
    assignees: [me],
    dueDate: isoDay(0),
    title: "Due today",
  });
  taskIds["later"] = await seedTask({
    assignees: [me],
    dueDate: isoDay(9),
    title: "Due later",
  });
  taskIds["undated"] = await seedTask({ assignees: [me], title: "Undated" });
  taskIds["done"] = await seedTask({
    assignees: [me],
    dueDate: isoDay(-5),
    status: "done",
    title: "Finished",
  });
  taskIds["archived"] = await seedTask({
    archived: true,
    assignees: [me],
    dueDate: isoDay(-5),
    title: "Archived",
  });
  taskIds["bug"] = await seedTask({
    assignees: [me],
    title: "A bug",
    type: "bug",
  });
  taskIds["notMine"] = await seedTask({
    assignees: [personaId("owner")],
    dueDate: isoDay(-1),
    title: "Someone else's",
  });
});
afterAll(teardownHarness);

it("lists open tasks assigned to the caller, soonest due first, undated last", async () => {
  const response = await send<Work>("GET", "/api/v1/workspace/me/work", {
    as: "outsider",
  });

  expect(response.status).toBe(200);
  expect(response.body.data.items.map(({ title }) => title)).toEqual([
    "Overdue",
    "Due today",
    "Due later",
    "Undated",
  ]);
  expect(response.body.data.items[0]).toMatchObject({
    id: taskIds["overdue"],
    isOverdue: true,
    version: 1,
  });
  expect(response.body.data.items[2]?.isOverdue).toBe(false);
  expect(response.body.data.nextOffset).toBeNull();
});

it("narrows the list to what is due by today or already overdue", async () => {
  const due = await send<Work>("GET", "/api/v1/workspace/me/work?scope=due", {
    as: "outsider",
  });
  const overdue = await send<Work>(
    "GET",
    "/api/v1/workspace/me/work?scope=overdue",
    { as: "outsider" }
  );

  expect(due.body.data.items.map(({ title }) => title)).toEqual([
    "Overdue",
    "Due today",
  ]);
  expect(overdue.body.data.items.map(({ title }) => title)).toEqual([
    "Overdue",
  ]);
});

it("pages through the list in a stable order", async () => {
  const first = await send<Work>("GET", "/api/v1/workspace/me/work?limit=3", {
    as: "outsider",
  });
  const second = await send<Work>(
    "GET",
    `/api/v1/workspace/me/work?limit=3&offset=${first.body.data.nextOffset}`,
    { as: "outsider" }
  );

  expect(first.body.data.items).toHaveLength(3);
  expect(first.body.data.nextOffset).toBe(3);
  expect(second.body.data.items.map(({ title }) => title)).toEqual(["Undated"]);
  expect(second.body.data.nextOffset).toBeNull();
});

it("refuses a page size above the bound with a field error", async () => {
  const response = await send("GET", "/api/v1/workspace/me/work?limit=500", {
    as: "outsider",
  });

  expect(response.status).toBe(422);
  expect(response.body.error.code).toBe("VALIDATION_FAILED");
  expect(response.body.error.fieldErrors).toHaveProperty("limit");
});

it("keeps clients out and requires a valid token", async () => {
  const client = await send("GET", "/api/v1/workspace/me/work", {
    as: "client",
  });
  const none = await send("GET", "/api/v1/workspace/me/work");
  const bad = await send("GET", "/api/v1/workspace/me/work", {
    token: "not-a-real-token",
  });

  expect(client.status).toBe(403);
  expect(none.status).toBe(401);
  expect(bad.status).toBe(401);
});
