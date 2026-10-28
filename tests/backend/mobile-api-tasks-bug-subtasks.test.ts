import { afterAll, beforeAll, expect, it } from "bun:test";

import {
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

const actionsOf = async (taskId: string): Promise<readonly string[]> => {
  const response = await send("GET", `/api/v1/workspace/tasks/${taskId}`, {
    as: "owner",
  });
  expect(response.status).toBe(200);
  return (response.body.data as { permittedActions: readonly string[] })
    .permittedActions;
};

// The web shows no subtasks on a bug, so the app must not offer or accept them.
it("refuses to add a subtask to a bug task, and changes nothing", async () => {
  const taskId = await seedTask({
    assignees: [personaId("owner")],
    type: "bug",
  });
  const before = await taskState(taskId);

  const response = await send("POST", subtaskPath(taskId), {
    as: "owner",
    body: { expectedVersion: 1, title: "Not on a bug" },
    key: newKey(),
  });

  expect(response.status).toBe(403);
  expect(response.body.error.code).toBe("FORBIDDEN");
  expect(await taskState(taskId)).toEqual(before);
});

it("refuses to change a subtask of a bug task, and changes nothing", async () => {
  const taskId = await seedTask({
    assignees: [personaId("owner")],
    type: "bug",
  });
  const subtaskId = await seedSubtask(taskId, "Left over", 0);
  const before = await taskState(taskId);

  const response = await send("PATCH", `${subtaskPath(taskId)}/${subtaskId}`, {
    as: "owner",
    body: { expectedVersion: 1, title: "Renamed" },
    key: newKey(),
  });

  expect(response.status).toBe(403);
  expect(await taskState(taskId)).toEqual(before);
});

it("does not offer subtask management on a bug task, but does on a task", async () => {
  const bugId = await seedTask({
    assignees: [personaId("owner")],
    type: "bug",
  });
  const taskId = await seedTask({ assignees: [personaId("owner")] });

  expect(await actionsOf(bugId)).not.toContain("manageSubtasks");
  expect(await actionsOf(taskId)).toContain("manageSubtasks");
});
