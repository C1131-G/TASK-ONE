import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  subtaskAddRoute,
  subtaskChangeRoute,
} from "../../src/mobile-api/routes-tasks";
import {
  authPool,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  decodesAs,
  isoDay,
  newKey,
  seedSubtask,
  seedTask,
  send,
  taskState,
} from "./support/mobile-tasks-fixtures";

interface SubtaskResult {
  readonly parentVersion: number;
  readonly subtask: {
    readonly assigneeId: string | null;
    readonly completed: boolean;
    readonly description: string | null;
    readonly dueDate: string | null;
    readonly id: string;
    readonly position: number;
    readonly taskId: string;
    readonly title: string;
  };
}

type Who = "owner" | "outsider" | "admin" | "client";

beforeAll(setupHarness);
afterAll(teardownHarness);

const seedOwned = () =>
  seedTask({
    assignees: [personaId("owner")],
    createdById: personaId("admin"),
  });

const subtaskPath = (taskId: string): string =>
  `/api/v1/workspace/tasks/${taskId}/subtasks`;

const add = (
  taskId: string,
  body: unknown,
  options: { as?: Who; key?: string } = {}
) =>
  send<SubtaskResult>("POST", subtaskPath(taskId), {
    as: options.as ?? "owner",
    body,
    key: options.key ?? newKey(),
  });

const toggle = (
  taskId: string,
  subtaskId: string,
  body: unknown,
  options: { as?: Who; key?: string } = {}
) =>
  send<SubtaskResult>("PATCH", `${subtaskPath(taskId)}/${subtaskId}`, {
    as: options.as ?? "owner",
    body,
    key: options.key ?? newKey(),
  });

it("adds a subtask and returns the parent's new version", async () => {
  const taskId = await seedOwned();

  const response = await add(taskId, {
    expectedVersion: 1,
    title: "Call the client",
  });

  expect(response.status).toBe(200);
  expect(decodesAs(subtaskAddRoute, response.body.data)).toBe(true);
  expect(response.body.data.parentVersion).toBe(2);
  expect(response.body.data.subtask).toMatchObject({
    completed: false,
    taskId,
    title: "Call the client",
  });
  const rows = await authPool.query(
    'SELECT title FROM task_subtask WHERE "taskId" = $1',
    [taskId]
  );
  expect(rows.rows).toHaveLength(1);
  const task = await authPool.query("SELECT version FROM task WHERE id = $1", [
    taskId,
  ]);
  expect(task.rows[0].version).toBe(2);
});

it("marks a subtask done without resending or changing its other fields", async () => {
  const taskId = await seedOwned();
  const subtaskId = await seedSubtask(taskId, "Write notes", 0, {
    assigneeId: personaId("owner"),
    description: "Keep the facts straight",
    dueDate: isoDay(2),
  });

  const response = await toggle(taskId, subtaskId, {
    completed: true,
    expectedVersion: 1,
  });

  expect(response.status).toBe(200);
  expect(decodesAs(subtaskChangeRoute, response.body.data)).toBe(true);
  expect(response.body.data.parentVersion).toBe(2);
  expect(response.body.data.subtask).toMatchObject({
    assigneeId: personaId("owner"),
    completed: true,
    description: "Keep the facts straight",
    dueDate: isoDay(2),
    id: subtaskId,
    title: "Write notes",
  });
  const row = await authPool.query(
    'SELECT "assigneeId", "isCompleted", "completedAt", description, "dueDate", title FROM task_subtask WHERE id = $1',
    [subtaskId]
  );
  expect(row.rows[0]).toMatchObject({
    assigneeId: personaId("owner"),
    description: "Keep the facts straight",
    isCompleted: true,
    title: "Write notes",
  });
  expect(row.rows[0].completedAt).not.toBeNull();
});

it("refuses an unrelated employee on add and change and leaves the task unchanged", async () => {
  const taskId = await seedOwned();
  const subtaskId = await seedSubtask(taskId, "Private step");
  const before = await taskState(taskId);

  const added = await add(
    taskId,
    { expectedVersion: 1, title: "Sneaky subtask" },
    { as: "outsider" }
  );
  const changed = await toggle(
    taskId,
    subtaskId,
    { completed: true, expectedVersion: 1 },
    { as: "outsider" }
  );

  expect(added.status).toBe(403);
  expect(changed.status).toBe(403);
  expect(await taskState(taskId)).toEqual(before);
});

it("answers 404 for a subtask under a different task and changes nothing", async () => {
  const taskId = await seedOwned();
  const otherTaskId = await seedOwned();
  const foreignSubtaskId = await seedSubtask(otherTaskId, "Belongs elsewhere");
  const before = await taskState(taskId);
  const otherBefore = await taskState(otherTaskId);

  const response = await toggle(taskId, foreignSubtaskId, {
    completed: true,
    expectedVersion: 1,
  });

  expect(response.status).toBe(404);
  expect(response.body.error.code).toBe("NOT_FOUND");
  expect(await taskState(taskId)).toEqual(before);
  expect(await taskState(otherTaskId)).toEqual(otherBefore);
});

it("answers 409 for a stale parent version and changes nothing", async () => {
  const taskId = await seedOwned();
  const created = await add(taskId, {
    expectedVersion: 1,
    title: "First step",
  });
  expect(created.status).toBe(200);
  const subtaskId = created.body.data.subtask.id;
  const before = await taskState(taskId);

  const staleAdd = await add(taskId, {
    expectedVersion: 1,
    title: "Stale addition",
  });
  const staleChange = await toggle(taskId, subtaskId, {
    completed: true,
    expectedVersion: 1,
  });

  expect(staleAdd.status).toBe(409);
  expect(staleAdd.body.error.code).toBe("CONFLICT");
  expect(staleChange.status).toBe(409);
  expect(staleChange.body.error.code).toBe("CONFLICT");
  expect(await taskState(taskId)).toEqual(before);
});

it("refuses an archived task on add and change and changes nothing", async () => {
  const taskId = await seedTask({
    archived: true,
    assignees: [personaId("owner")],
  });
  const subtaskId = await seedSubtask(taskId, "Archived step");
  const before = await taskState(taskId);

  const added = await add(taskId, {
    expectedVersion: 1,
    title: "Archived addition",
  });
  const changed = await toggle(taskId, subtaskId, {
    completed: true,
    expectedVersion: 1,
  });

  expect(added.status).toBe(403);
  expect(changed.status).toBe(403);
  expect(await taskState(taskId)).toEqual(before);
});

it("refuses clients, anonymous callers and an invalid token without writing", async () => {
  const taskId = await seedOwned();
  const subtaskId = await seedSubtask(taskId, "Guarded step");
  const before = await taskState(taskId);
  const body = { expectedVersion: 1, title: "Not allowed" };

  const clientAdd = await add(taskId, body, { as: "client" });
  const clientChange = await toggle(
    taskId,
    subtaskId,
    { completed: true, expectedVersion: 1 },
    { as: "client" }
  );
  const anonymous = await send("POST", subtaskPath(taskId), {
    body,
    key: newKey(),
  });
  const forged = await send("POST", subtaskPath(taskId), {
    body,
    key: newKey(),
    token: "not-a-real-token",
  });

  expect(clientAdd.status).toBe(403);
  expect(clientChange.status).toBe(403);
  expect(anonymous.status).toBe(401);
  expect(forged.status).toBe(401);
  expect(await taskState(taskId)).toEqual(before);
});

it("replays a retry with the same key as one subtask", async () => {
  const taskId = await seedOwned();
  const key = newKey();
  const body = { expectedVersion: 1, title: "Only once" };

  const first = await add(taskId, body, { key });
  const retry = await add(taskId, body, { key });

  expect(first.status).toBe(200);
  expect(retry.status).toBe(200);
  expect(retry.body.data).toEqual(first.body.data);
  const rows = await authPool.query(
    'SELECT id FROM task_subtask WHERE "taskId" = $1',
    [taskId]
  );
  expect(rows.rows).toHaveLength(1);
});

it("conflicts when a key is reused with a different body and creates nothing", async () => {
  const taskId = await seedOwned();
  const key = newKey();
  await add(taskId, { expectedVersion: 1, title: "Key owner" }, { key });
  const before = await taskState(taskId);

  const reused = await add(
    taskId,
    { expectedVersion: 2, title: "Key thief" },
    { key }
  );

  expect(reused.status).toBe(409);
  expect(reused.body.error.code).toBe("CONFLICT");
  expect(await taskState(taskId)).toEqual(before);
});

it("reports field errors for bad input and writes nothing", async () => {
  const taskId = await seedOwned();
  const before = await taskState(taskId);

  const blankTitle = await add(taskId, {
    expectedVersion: 1,
    title: "   ",
  });
  const longTitle = await add(taskId, {
    expectedVersion: 1,
    title: "a".repeat(241),
  });
  const noVersion = await add(taskId, { title: "No version" });
  const noKey = await send("POST", subtaskPath(taskId), {
    as: "owner",
    body: { expectedVersion: 1, title: "No key" },
  });

  expect(blankTitle.status).toBe(422);
  expect(longTitle.status).toBe(422);
  expect(Object.keys(noVersion.body.error.fieldErrors ?? {})).toContain(
    "expectedVersion"
  );
  expect(noKey.status).toBe(422);
  expect(await taskState(taskId)).toEqual(before);
});
