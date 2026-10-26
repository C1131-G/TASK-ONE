import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  authPool,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import {
  newKey,
  seedSubtask,
  seedTask,
  send,
  taskState,
} from "./support/mobile-tasks-fixtures";

beforeAll(setupHarness);
afterAll(teardownHarness);

const seedOwned = () =>
  seedTask({
    assignees: [personaId("owner")],
    createdById: personaId("admin"),
  });

const taskPath = (taskId: string): string =>
  `/api/v1/workspace/tasks/${taskId}`;

const fieldNames = (response: {
  readonly body: { readonly error: { readonly fieldErrors?: object } };
}): string[] => Object.keys(response.body.error.fieldErrors ?? {});

it("replays a subtask change retried with the same key as one change", async () => {
  const taskId = await seedOwned();
  const subtaskId = await seedSubtask(taskId, "Retry me");
  const key = newKey();
  const path = `${taskPath(taskId)}/subtasks/${subtaskId}`;
  const body = { completed: true, expectedVersion: 1 };

  const first = await send("PATCH", path, { as: "owner", body, key });
  const retry = await send("PATCH", path, { as: "owner", body, key });

  expect(first.status).toBe(200);
  expect(retry.status).toBe(200);
  expect(retry.body.data).toEqual(first.body.data);
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

it("conflicts when a key is reused with a different subtask change or status body", async () => {
  const taskId = await seedOwned();
  const subtaskId = await seedSubtask(taskId, "Key owner");
  const changeKey = newKey();
  const statusKey = newKey();
  const changePath = `${taskPath(taskId)}/subtasks/${subtaskId}`;
  const statusPath = `${changePath}/status`;
  await send("PATCH", changePath, {
    as: "owner",
    body: { expectedVersion: 1, title: "Renamed" },
    key: changeKey,
  });
  await send("POST", statusPath, {
    as: "owner",
    body: { done: true, expectedVersion: 2 },
    key: statusKey,
  });
  const before = await taskState(taskId);

  const changeReuse = await send("PATCH", changePath, {
    as: "owner",
    body: { expectedVersion: 1, title: "Renamed again" },
    key: changeKey,
  });
  const statusReuse = await send("POST", statusPath, {
    as: "owner",
    body: { done: false, expectedVersion: 2 },
    key: statusKey,
  });

  expect(changeReuse.status).toBe(409);
  expect(changeReuse.body.error.code).toBe("CONFLICT");
  expect(statusReuse.status).toBe(409);
  expect(statusReuse.body.error.code).toBe("CONFLICT");
  expect(await taskState(taskId)).toEqual(before);
});

it("leaves another user's running timer untouched when a coworker starts and stops theirs", async () => {
  const taskId = await seedOwned();
  const otherTaskId = await seedTask({ assignees: [personaId("outsider")] });
  await authPool.query(
    'DELETE FROM time_timer WHERE "userId" = ANY($1::text[])',
    [[personaId("owner"), personaId("outsider")]]
  );
  const ownerStart = await send("POST", "/api/v1/workspace/me/timer/start", {
    as: "owner",
    body: { billable: true, note: "Owner work", taskId },
    key: newKey(),
  });
  expect(ownerStart.status).toBe(200);
  const ownerTimerBefore = await authPool.query(
    'SELECT * FROM time_timer WHERE "userId" = $1',
    [personaId("owner")]
  );

  const outsiderStart = await send("POST", "/api/v1/workspace/me/timer/start", {
    as: "outsider",
    body: { billable: false, taskId: otherTaskId },
    key: newKey(),
  });
  const outsiderStop = await send("POST", "/api/v1/workspace/me/timer/stop", {
    as: "outsider",
    key: newKey(),
  });

  expect(outsiderStart.status).toBe(200);
  expect(outsiderStart.body.data).toMatchObject({ stopped: null });
  expect(outsiderStop.status).toBe(200);
  expect(outsiderStop.body.data).toMatchObject({
    taskId: otherTaskId,
    userId: personaId("outsider"),
  });
  const ownerTimerAfter = await authPool.query(
    'SELECT * FROM time_timer WHERE "userId" = $1',
    [personaId("owner")]
  );
  expect(ownerTimerAfter.rows).toEqual(ownerTimerBefore.rows);
  const entries = await authPool.query(
    'SELECT "userId" FROM time_entry WHERE "taskId" = ANY($1::uuid[])',
    [[taskId, otherTaskId]]
  );
  expect(entries.rows).toEqual([{ userId: personaId("outsider") }]);
});

it("keeps one running timer per caller when the same caller starts twice", async () => {
  const first = await seedTask({ assignees: [personaId("owner")] });
  const second = await seedTask({ assignees: [personaId("owner")] });
  await authPool.query('DELETE FROM time_timer WHERE "userId" = $1', [
    personaId("owner"),
  ]);

  await send("POST", "/api/v1/workspace/me/timer/start", {
    as: "owner",
    body: { billable: true, taskId: first },
    key: newKey(),
  });
  const switched = await send("POST", "/api/v1/workspace/me/timer/start", {
    as: "owner",
    body: { billable: true, taskId: second },
    key: newKey(),
  });

  expect(switched.status).toBe(200);
  const timers = await authPool.query(
    'SELECT "taskId" FROM time_timer WHERE "userId" = $1',
    [personaId("owner")]
  );
  expect(timers.rows).toEqual([{ taskId: second }]);
});

it("reports field errors for a bad comment, timer start or task id and writes nothing", async () => {
  const taskId = await seedOwned();
  const before = await taskState(taskId);
  const timersBefore = await authPool.query(
    "SELECT count(*)::int AS n FROM time_timer"
  );

  const emptyComment = await send("POST", `${taskPath(taskId)}/comments`, {
    as: "owner",
    body: { body: "   " },
    key: newKey(),
  });
  const noBody = await send("POST", `${taskPath(taskId)}/comments`, {
    as: "owner",
    body: { visibility: "internal" },
    key: newKey(),
  });
  const badVisibility = await send("POST", `${taskPath(taskId)}/comments`, {
    as: "owner",
    body: { body: "Hello", visibility: "secret" },
    key: newKey(),
  });
  const badTimerTask = await send("POST", "/api/v1/workspace/me/timer/start", {
    as: "owner",
    body: { billable: true, taskId: "not-a-uuid" },
    key: newKey(),
  });
  const noBillable = await send("POST", "/api/v1/workspace/me/timer/start", {
    as: "owner",
    body: { taskId },
    key: newKey(),
  });
  const badPathId = await send("GET", taskPath("not-a-uuid"), { as: "owner" });

  expect(emptyComment.status).toBe(422);
  expect(noBody.status).toBe(422);
  expect(fieldNames(noBody)).toContain("body");
  expect(badVisibility.status).toBe(422);
  expect(fieldNames(badVisibility)).toContain("visibility");
  expect(badTimerTask.status).toBe(422);
  expect(fieldNames(badTimerTask)).toContain("taskId");
  expect(noBillable.status).toBe(422);
  expect(fieldNames(noBillable)).toContain("billable");
  expect(badPathId.status).toBe(422);
  expect(fieldNames(badPathId)).toContain("taskId");
  expect(await taskState(taskId)).toEqual(before);
  const timersAfter = await authPool.query(
    "SELECT count(*)::int AS n FROM time_timer"
  );
  expect(timersAfter.rows).toEqual(timersBefore.rows);
});
