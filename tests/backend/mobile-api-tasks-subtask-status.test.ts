import { afterAll, beforeAll, expect, it } from "bun:test";

import { subtaskStatusRoute } from "../../src/mobile-api/routes-tasks";
import {
  authPool,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  decodesAs,
  newKey,
  seedSubtask,
  seedTask,
  send,
  taskState,
} from "./support/mobile-tasks-fixtures";

interface SubtaskStatus {
  readonly done: boolean;
  readonly version: number;
}

type Who = "owner" | "outsider" | "admin" | "client";

beforeAll(setupHarness);
afterAll(teardownHarness);

const seedOwned = () =>
  seedTask({
    assignees: [personaId("owner")],
    createdById: personaId("admin"),
  });

const statusPath = (taskId: string, subtaskId: string): string =>
  `/api/v1/workspace/tasks/${taskId}/subtasks/${subtaskId}/status`;

const setStatus = (
  taskId: string,
  subtaskId: string,
  body: unknown,
  options: { as?: Who; key?: string } = {}
) =>
  send<SubtaskStatus>("POST", statusPath(taskId, subtaskId), {
    as: options.as ?? "owner",
    body,
    key: options.key ?? newKey(),
  });

it("toggles a subtask done and back while bumping the parent version once per write", async () => {
  const taskId = await seedOwned();
  const subtaskId = await seedSubtask(taskId, "Ship the release");

  const done = await setStatus(taskId, subtaskId, {
    done: true,
    expectedVersion: 1,
  });

  expect(done.status).toBe(200);
  expect(decodesAs(subtaskStatusRoute, done.body.data)).toBe(true);
  expect(done.body.data).toEqual({ done: true, version: 2 });
  expect(Object.keys(done.body.data).toSorted()).toEqual(["done", "version"]);
  const doneRow = await authPool.query(
    'SELECT "isCompleted", "completedAt" FROM task_subtask WHERE id = $1',
    [subtaskId]
  );
  expect(doneRow.rows[0].isCompleted).toBe(true);
  expect(doneRow.rows[0].completedAt).not.toBeNull();
  const afterDone = await authPool.query(
    "SELECT version FROM task WHERE id = $1",
    [taskId]
  );
  expect(afterDone.rows[0].version).toBe(2);

  const reopened = await setStatus(taskId, subtaskId, {
    done: false,
    expectedVersion: 2,
  });

  expect(reopened.status).toBe(200);
  expect(reopened.body.data).toEqual({ done: false, version: 3 });
  const reopenedRow = await authPool.query(
    'SELECT "isCompleted", "completedAt" FROM task_subtask WHERE id = $1',
    [subtaskId]
  );
  expect(reopenedRow.rows[0].isCompleted).toBe(false);
  expect(reopenedRow.rows[0].completedAt).toBeNull();
  const afterReopen = await authPool.query(
    "SELECT version FROM task WHERE id = $1",
    [taskId]
  );
  expect(afterReopen.rows[0].version).toBe(3);
});

it("answers 409 for a stale version and leaves the task and subtask unchanged", async () => {
  const taskId = await seedOwned();
  const subtaskId = await seedSubtask(taskId, "Fresh step");
  await setStatus(taskId, subtaskId, { done: true, expectedVersion: 1 });
  const before = await taskState(taskId);

  const stale = await setStatus(taskId, subtaskId, {
    done: false,
    expectedVersion: 1,
  });

  expect(stale.status).toBe(409);
  expect(stale.body.error.code).toBe("CONFLICT");
  expect(await taskState(taskId)).toEqual(before);
});

it("answers 404 for a subtask under another task and changes nothing", async () => {
  const taskId = await seedOwned();
  const otherTaskId = await seedOwned();
  const foreignSubtaskId = await seedSubtask(otherTaskId, "Belongs elsewhere");
  const before = await taskState(taskId);
  const otherBefore = await taskState(otherTaskId);

  const response = await setStatus(taskId, foreignSubtaskId, {
    done: true,
    expectedVersion: 1,
  });

  expect(response.status).toBe(404);
  expect(response.body.error.code).toBe("NOT_FOUND");
  expect(await taskState(taskId)).toEqual(before);
  expect(await taskState(otherTaskId)).toEqual(otherBefore);
});

it("refuses an archived task and changes nothing", async () => {
  const taskId = await seedTask({
    archived: true,
    assignees: [personaId("owner")],
  });
  const subtaskId = await seedSubtask(taskId, "Archived step");
  const before = await taskState(taskId);

  const response = await setStatus(taskId, subtaskId, {
    done: true,
    expectedVersion: 1,
  });

  expect(response.status).toBe(403);
  expect(await taskState(taskId)).toEqual(before);
});

it("refuses an unrelated employee, clients, anonymous callers and an invalid token", async () => {
  const taskId = await seedOwned();
  const subtaskId = await seedSubtask(taskId, "Guarded step");
  const before = await taskState(taskId);
  const body = { done: true, expectedVersion: 1 };

  const outsider = await setStatus(taskId, subtaskId, body, { as: "outsider" });
  const client = await setStatus(taskId, subtaskId, body, { as: "client" });
  const anonymous = await send("POST", statusPath(taskId, subtaskId), {
    body,
    key: newKey(),
  });
  const forged = await send("POST", statusPath(taskId, subtaskId), {
    body,
    key: newKey(),
    token: "not-a-real-token",
  });

  expect(outsider.status).toBe(403);
  expect(client.status).toBe(403);
  expect(anonymous.status).toBe(401);
  expect(forged.status).toBe(401);
  expect(await taskState(taskId)).toEqual(before);
});

it("replays a retry with the same key without bumping the version twice", async () => {
  const taskId = await seedOwned();
  const subtaskId = await seedSubtask(taskId, "Only once");
  const key = newKey();
  const body = { done: true, expectedVersion: 1 };

  const first = await setStatus(taskId, subtaskId, body, { key });
  const retry = await setStatus(taskId, subtaskId, body, { key });

  expect(first.status).toBe(200);
  expect(retry.status).toBe(200);
  expect(retry.body.data).toEqual(first.body.data);
  expect(retry.body.data).toEqual({ done: true, version: 2 });
  const task = await authPool.query("SELECT version FROM task WHERE id = $1", [
    taskId,
  ]);
  expect(task.rows[0].version).toBe(2);
  const activity = await authPool.query(
    `SELECT id FROM activity WHERE "taskId" = $1 AND action = 'subtask.updated'`,
    [taskId]
  );
  expect(activity.rows).toHaveLength(1);
});

it("reports field errors for bad input and writes nothing", async () => {
  const taskId = await seedOwned();
  const subtaskId = await seedSubtask(taskId, "Untouched");
  const before = await taskState(taskId);

  const noDone = await setStatus(taskId, subtaskId, { expectedVersion: 1 });
  const noVersion = await setStatus(taskId, subtaskId, { done: true });
  const noKey = await send("POST", statusPath(taskId, subtaskId), {
    as: "owner",
    body: { done: true, expectedVersion: 1 },
  });

  expect(noDone.status).toBe(422);
  expect(Object.keys(noDone.body.error.fieldErrors ?? {})).toContain("done");
  expect(noVersion.status).toBe(422);
  expect(Object.keys(noVersion.body.error.fieldErrors ?? {})).toContain(
    "expectedVersion"
  );
  expect(noKey.status).toBe(422);
  expect(await taskState(taskId)).toEqual(before);
});
