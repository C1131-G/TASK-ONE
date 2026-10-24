import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  authPool,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  isoDay,
  newKey,
  seedTask,
  send,
  taskState,
} from "./support/mobile-tasks-fixtures";

interface Change {
  readonly id: string;
  readonly version: number;
  readonly status: string;
  readonly priority: string;
  readonly dueDate: string | null;
  readonly assigneeIds: readonly string[];
}

beforeAll(setupHarness);
afterAll(teardownHarness);

const patch = (
  taskId: string,
  body: unknown,
  options: { as?: "owner" | "outsider" | "admin" | "client"; key?: string } = {}
) =>
  send<Change>("PATCH", `/api/v1/workspace/tasks/${taskId}`, {
    as: options.as ?? "owner",
    body,
    key: options.key ?? newKey(),
  });

const seedOwned = () =>
  seedTask({
    assignees: [personaId("owner")],
    createdById: personaId("admin"),
    dueDate: isoDay(3),
    priority: "medium",
    status: "todo",
  });

it("lets an assignee change status, priority and due date and returns the new version", async () => {
  const taskId = await seedOwned();

  const response = await patch(taskId, {
    dueDate: isoDay(7),
    expectedVersion: 1,
    priority: "urgent",
    status: "done",
  });

  expect(response.status).toBe(200);
  expect(response.body.data).toMatchObject({
    dueDate: isoDay(7),
    id: taskId,
    priority: "urgent",
    status: "done",
    version: 2,
  });
  const row = await authPool.query(
    'SELECT status, priority, "dueDate", version FROM task WHERE id = $1',
    [taskId]
  );
  expect(row.rows[0]).toMatchObject({
    priority: "urgent",
    status: "done",
    version: 2,
  });
  expect(await taskState(taskId)).toBeDefined();
});

it("replaces the assignees and notifies the new one", async () => {
  const taskId = await seedOwned();

  const response = await patch(taskId, {
    assigneeIds: [personaId("outsider")],
    expectedVersion: 1,
  });

  expect(response.status).toBe(200);
  expect(response.body.data.assigneeIds).toEqual([personaId("outsider")]);
  expect(response.body.data.version).toBe(2);
  const notices = await authPool.query(
    `SELECT id FROM notification WHERE "taskId" = $1 AND "userId" = $2 AND type = 'assignment'`,
    [taskId, personaId("outsider")]
  );
  expect(notices.rows).toHaveLength(1);
});

it("refuses an unrelated employee and leaves the task unchanged", async () => {
  const taskId = await seedOwned();
  const before = await taskState(taskId);

  const response = await patch(
    taskId,
    { expectedVersion: 1, status: "done" },
    { as: "outsider" }
  );

  expect(response.status).toBe(403);
  expect(await taskState(taskId)).toEqual(before);
});

it("lets an admin and the creator edit a task they do not work on", async () => {
  const adminTask = await seedOwned();
  const creatorTask = await seedTask({
    assignees: [personaId("admin")],
    createdById: personaId("outsider"),
  });

  const byAdmin = await patch(
    adminTask,
    { expectedVersion: 1, priority: "low" },
    { as: "admin" }
  );
  const byCreator = await patch(
    creatorTask,
    { expectedVersion: 1, priority: "low" },
    { as: "outsider" }
  );

  expect(byAdmin.status).toBe(200);
  expect(byCreator.status).toBe(200);
});

it("answers 409 for a stale version and leaves the row unchanged", async () => {
  const taskId = await seedOwned();
  await patch(taskId, { expectedVersion: 1, priority: "high" });
  const before = await taskState(taskId);

  const stale = await patch(taskId, { expectedVersion: 1, status: "review" });

  expect(stale.status).toBe(409);
  expect(stale.body.error.code).toBe("CONFLICT");
  expect(await taskState(taskId)).toEqual(before);
});

it("replays a retry with the same key as one change", async () => {
  const taskId = await seedOwned();
  const key = newKey();
  const body = { expectedVersion: 1, status: "progress" };

  const first = await patch(taskId, body, { key });
  const retry = await patch(taskId, body, { key });

  expect(first.status).toBe(200);
  expect(retry.status).toBe(200);
  expect(retry.body.data).toEqual(first.body.data);
  expect(retry.body.data.version).toBe(2);
  const activity = await authPool.query(
    `SELECT id FROM activity WHERE "taskId" = $1 AND action = 'task.updated'`,
    [taskId]
  );
  expect(activity.rows).toHaveLength(1);
});

it("conflicts when a key is reused with a different body", async () => {
  const taskId = await seedOwned();
  const key = newKey();
  await patch(taskId, { expectedVersion: 1, status: "progress" }, { key });
  const before = await taskState(taskId);

  const reused = await patch(
    taskId,
    { expectedVersion: 2, status: "done" },
    { key }
  );

  expect(reused.status).toBe(409);
  expect(await taskState(taskId)).toEqual(before);
});

it("refuses an archived task", async () => {
  const taskId = await seedTask({
    archived: true,
    assignees: [personaId("owner")],
  });
  const before = await taskState(taskId);

  const response = await patch(taskId, { expectedVersion: 1, status: "done" });

  expect(response.status).toBe(403);
  expect(await taskState(taskId)).toEqual(before);
});

it("refuses clients, anonymous callers and a revoked token", async () => {
  const taskId = await seedOwned();
  const before = await taskState(taskId);
  const body = { expectedVersion: 1, status: "done" };

  const client = await patch(taskId, body, { as: "client" });
  const anonymous = await send("PATCH", `/api/v1/workspace/tasks/${taskId}`, {
    body,
    key: newKey(),
  });
  const forged = await send("PATCH", `/api/v1/workspace/tasks/${taskId}`, {
    body,
    key: newKey(),
    token: "not-a-real-token",
  });

  expect(client.status).toBe(403);
  expect(anonymous.status).toBe(401);
  expect(forged.status).toBe(401);
  expect(await taskState(taskId)).toEqual(before);
});

it("reports field errors for bad input and writes nothing", async () => {
  const taskId = await seedOwned();
  const before = await taskState(taskId);

  const badStatus = await patch(taskId, {
    expectedVersion: 1,
    status: "finished",
  });
  const noVersion = await patch(taskId, { status: "done" });
  const noChange = await patch(taskId, { expectedVersion: 1 });
  const badDate = await patch(taskId, {
    dueDate: "2026-02-31",
    expectedVersion: 1,
  });
  const noKey = await send("PATCH", `/api/v1/workspace/tasks/${taskId}`, {
    as: "owner",
    body: { expectedVersion: 1, status: "done" },
  });

  expect(badStatus.status).toBe(422);
  expect(badStatus.body.error.code).toBe("VALIDATION_FAILED");
  expect(Object.keys(badStatus.body.error.fieldErrors ?? {})).toContain(
    "status"
  );
  expect(Object.keys(noVersion.body.error.fieldErrors ?? {})).toContain(
    "expectedVersion"
  );
  expect(noChange.status).toBe(422);
  expect(badDate.status).toBe(422);
  expect(noKey.status).toBe(422);
  expect(await taskState(taskId)).toEqual(before);
});

it("answers 404 for a task that does not exist", async () => {
  const response = await patch("00000000-0000-4000-8000-000000000000", {
    expectedVersion: 1,
    status: "done",
  });

  expect(response.status).toBe(404);
});
