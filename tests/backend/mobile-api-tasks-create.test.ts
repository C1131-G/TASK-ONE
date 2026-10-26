import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import { isoDay, newKey, send } from "./support/mobile-tasks-fixtures";

interface Created {
  readonly id: string;
  readonly projectId: string;
  readonly reference: string;
  readonly title: string;
  readonly status: string;
  readonly priority: string;
  readonly dueDate: string | null;
  readonly version: number;
  readonly assigneeIds: readonly string[];
}

beforeAll(setupHarness);
afterAll(teardownHarness);

const create = (
  body: unknown,
  options: { as?: "owner" | "outsider" | "admin" | "client"; key?: string } = {}
) =>
  send<Created>("POST", "/api/v1/workspace/tasks", {
    as: options.as ?? "owner",
    body,
    key: options.key ?? newKey(),
  });

const taskCount = async (title: string): Promise<number> => {
  const result = await authPool.query(
    "SELECT count(*)::int AS count FROM task WHERE title = $1",
    [title]
  );
  return result.rows[0].count;
};

it("lets an employee create a task and assign it", async () => {
  const response = await create({
    assigneeIds: [personaId("outsider")],
    dueDate: isoDay(4),
    priority: "high",
    projectId: ids.projectId,
    title: "Mobile created",
  });

  expect(response.status).toBe(200);
  expect(response.body.data).toMatchObject({
    assigneeIds: [personaId("outsider")],
    dueDate: isoDay(4),
    priority: "high",
    projectId: ids.projectId,
    status: "todo",
    title: "Mobile created",
    version: 1,
  });
  expect(response.body.data.reference).toMatch(/-\d+$/u);
  const row = await authPool.query(
    'SELECT "createdById" FROM task WHERE id = $1',
    [response.body.data.id]
  );
  expect(row.rows[0].createdById).toBe(personaId("owner"));
});

it("lets an admin create a task with the same rules", async () => {
  const response = await create(
    { assigneeIds: [], projectId: ids.projectId, title: "Admin created" },
    { as: "admin" }
  );

  expect(response.status).toBe(200);
  expect(response.body.data).toMatchObject({
    priority: "medium",
    status: "todo",
    title: "Admin created",
  });
});

it("replays a retry with the same key as one task", async () => {
  const key = newKey();
  const body = {
    assigneeIds: [],
    projectId: ids.projectId,
    title: "Created once",
  };

  const first = await create(body, { key });
  const retry = await create(body, { key });

  expect(retry.status).toBe(200);
  expect(retry.body.data).toEqual(first.body.data);
  expect(await taskCount("Created once")).toBe(1);
});

it("conflicts when a key is reused with a different body", async () => {
  const key = newKey();
  await create(
    { assigneeIds: [], projectId: ids.projectId, title: "Key owner" },
    { key }
  );

  const reused = await create(
    { assigneeIds: [], projectId: ids.projectId, title: "Key thief" },
    { key }
  );

  expect(reused.status).toBe(409);
  expect(await taskCount("Key thief")).toBe(0);
});

it("refuses clients, anonymous callers and a bad token, creating nothing", async () => {
  const body = {
    assigneeIds: [],
    projectId: ids.projectId,
    title: "Never created",
  };

  const client = await create(body, { as: "client" });
  const anonymous = await send("POST", "/api/v1/workspace/tasks", {
    body,
    key: newKey(),
  });
  const forged = await send("POST", "/api/v1/workspace/tasks", {
    body,
    key: newKey(),
    token: "not-a-real-token",
  });

  expect(client.status).toBe(403);
  expect(anonymous.status).toBe(401);
  expect(forged.status).toBe(401);
  expect(await taskCount("Never created")).toBe(0);
});

it("reports field errors and refuses unknown or archived projects", async () => {
  const noTitle = await create({
    assigneeIds: [],
    projectId: ids.projectId,
    title: "   ",
  });
  const badProject = await create({
    assigneeIds: [],
    projectId: "not-a-uuid",
    title: "Bad project",
  });
  const archivedProject = await create({
    assigneeIds: [],
    projectId: ids.archivedProjectId,
    title: "In archive",
  });
  const clientAssignee = await create({
    assigneeIds: [personaId("client")],
    projectId: ids.projectId,
    title: "Client assignee",
  });
  const noKey = await send("POST", "/api/v1/workspace/tasks", {
    as: "owner",
    body: { assigneeIds: [], projectId: ids.projectId, title: "No key" },
  });

  expect(noTitle.status).toBe(422);
  expect(badProject.status).toBe(422);
  expect(Object.keys(badProject.body.error.fieldErrors ?? {})).toContain(
    "projectId"
  );
  expect(archivedProject.status).toBe(404);
  expect(clientAssignee.status).toBe(422);
  expect(noKey.status).toBe(422);
  for (const title of [
    "In archive",
    "Client assignee",
    "No key",
    "Bad project",
  ]) {
    // eslint-disable-next-line no-await-in-loop
    expect(await taskCount(title)).toBe(0);
  }
});
