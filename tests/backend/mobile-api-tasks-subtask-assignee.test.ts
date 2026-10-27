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

const subtaskPath = (taskId: string): string =>
  `/api/v1/workspace/tasks/${taskId}/subtasks`;

const subtaskRows = async (taskId: string) => {
  const result = await authPool.query(
    'SELECT id, "assigneeId", title FROM task_subtask WHERE "taskId" = $1 ORDER BY id',
    [taskId]
  );
  return result.rows;
};

it("refuses to add a subtask assigned to a client account", async () => {
  const taskId = await seedTask({ assignees: [personaId("owner")] });
  const before = {
    rows: await subtaskRows(taskId),
    task: await taskState(taskId),
  };

  const response = await send("POST", subtaskPath(taskId), {
    as: "owner",
    body: {
      assigneeId: personaId("client"),
      expectedVersion: 1,
      title: "Client should not own this",
    },
    key: newKey(),
  });

  expect(response.status).toBe(422);
  expect(response.body.error.code).toBe("VALIDATION_FAILED");
  expect({
    rows: await subtaskRows(taskId),
    task: await taskState(taskId),
  }).toEqual(before);
});

it("refuses to hand an existing subtask to a client account", async () => {
  const taskId = await seedTask({ assignees: [personaId("owner")] });
  const subtaskId = await seedSubtask(taskId, "Staff only", 0, {
    assigneeId: personaId("owner"),
  });
  const before = {
    rows: await subtaskRows(taskId),
    task: await taskState(taskId),
  };

  const response = await send("PATCH", `${subtaskPath(taskId)}/${subtaskId}`, {
    as: "owner",
    body: { assigneeId: personaId("client"), expectedVersion: 1 },
    key: newKey(),
  });

  expect(response.status).toBe(422);
  expect({
    rows: await subtaskRows(taskId),
    task: await taskState(taskId),
  }).toEqual(before);
});

it("still lets staff assign a subtask to a coworker", async () => {
  const taskId = await seedTask({ assignees: [personaId("owner")] });

  const response = await send("POST", subtaskPath(taskId), {
    as: "owner",
    body: {
      assigneeId: personaId("admin"),
      expectedVersion: 1,
      title: "Staff can own this",
    },
    key: newKey(),
  });

  expect(response.status).toBe(200);
});
