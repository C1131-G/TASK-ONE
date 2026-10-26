import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  createPersona,
  ids,
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

interface RouteCall {
  readonly body?: unknown;
  readonly method: "GET" | "PATCH" | "POST";
  readonly name: string;
  readonly path: string;
  readonly write: boolean;
}

// One call for every task route, aimed at a task the owner works on.
const seedCalls = async (): Promise<{
  calls: readonly RouteCall[];
  taskId: string;
}> => {
  const taskId = await seedTask({
    assignees: [personaId("owner")],
    createdById: personaId("admin"),
  });
  const subtaskId = await seedSubtask(taskId, "Guarded step");
  const task = `/api/v1/workspace/tasks/${taskId}`;
  return {
    calls: [
      {
        method: "GET",
        name: "getMyWork",
        path: "/api/v1/workspace/me/work",
        write: false,
      },
      { method: "GET", name: "getTaskContext", path: task, write: false },
      {
        body: { expectedVersion: 1, status: "done" },
        method: "PATCH",
        name: "changeTask",
        path: task,
        write: true,
      },
      {
        body: {
          assigneeIds: [personaId("owner")],
          projectId: ids.projectId,
          title: "Client-made task",
        },
        method: "POST",
        name: "createTask",
        path: "/api/v1/workspace/tasks",
        write: true,
      },
      {
        body: { expectedVersion: 1, title: "Not allowed" },
        method: "POST",
        name: "addSubtask",
        path: `${task}/subtasks`,
        write: true,
      },
      {
        body: { completed: true, expectedVersion: 1 },
        method: "PATCH",
        name: "changeSubtask",
        path: `${task}/subtasks/${subtaskId}`,
        write: true,
      },
      {
        body: { done: true, expectedVersion: 1 },
        method: "POST",
        name: "setSubtaskStatus",
        path: `${task}/subtasks/${subtaskId}/status`,
        write: true,
      },
      {
        body: { body: "Not allowed" },
        method: "POST",
        name: "addTaskComment",
        path: `${task}/comments`,
        write: true,
      },
      {
        method: "GET",
        name: "getMyTimer",
        path: "/api/v1/workspace/me/timer",
        write: false,
      },
      {
        body: { billable: true, taskId },
        method: "POST",
        name: "startMyTimer",
        path: "/api/v1/workspace/me/timer/start",
        write: true,
      },
      {
        method: "POST",
        name: "stopMyTimer",
        path: "/api/v1/workspace/me/timer/stop",
        write: true,
      },
    ],
    taskId,
  };
};

const COUNTED_TABLES = [
  "task",
  "task_assignee",
  "task_subtask",
  "comment",
  "activity",
  "notification",
  "time_timer",
  "time_entry",
  "idempotency_key",
] as const;

// Row counts of every table a task write can touch, plus the task's own rows.
const snapshot = async (taskId: string): Promise<unknown> => {
  const counts: Record<string, number> = {};
  for (const table of COUNTED_TABLES) {
    // eslint-disable-next-line no-await-in-loop
    const result = await authPool.query(
      `SELECT count(*)::int AS n FROM ${table}`
    );
    counts[table] = result.rows[0].n;
  }
  return { counts, task: await taskState(taskId) };
};

const callAs = (call: RouteCall, auth: { as?: "client"; token?: string }) =>
  send(call.method, call.path, {
    ...auth,
    ...(call.body === undefined ? {} : { body: call.body }),
    ...(call.write ? { key: newKey() } : {}),
  });

it("refuses a client token on every task route and writes nothing", async () => {
  const { calls, taskId } = await seedCalls();
  const before = await snapshot(taskId);

  for (const call of calls) {
    // eslint-disable-next-line no-await-in-loop
    const response = await callAs(call, { as: "client" });
    expect([call.name, response.status]).toEqual([call.name, 403]);
    expect(response.body.ok).toBe(false);
  }

  expect(await snapshot(taskId)).toEqual(before);
});

it("answers 401 on every task route without a token or with a forged one", async () => {
  const { calls, taskId } = await seedCalls();
  const before = await snapshot(taskId);

  for (const call of calls) {
    // eslint-disable-next-line no-await-in-loop
    const missing = await callAs(call, {});
    // eslint-disable-next-line no-await-in-loop
    const forged = await callAs(call, { token: "not-a-real-token" });
    expect([call.name, missing.status]).toEqual([call.name, 401]);
    expect([call.name, forged.status]).toEqual([call.name, 401]);
  }

  expect(await snapshot(taskId)).toEqual(before);
});

it("answers 401 on every task route once the token's session is revoked", async () => {
  const revoked = await createPersona("employee", `revoked-${randomUUID()}`);
  const { calls, taskId } = await seedCalls();
  const before = await snapshot(taskId);
  await authPool.query('DELETE FROM session WHERE "userId" = $1', [revoked.id]);

  for (const call of calls) {
    // eslint-disable-next-line no-await-in-loop
    const response = await callAs(call, { token: revoked.bearerToken });
    expect([call.name, response.status]).toEqual([call.name, 401]);
  }

  expect(await snapshot(taskId)).toEqual(before);
});
