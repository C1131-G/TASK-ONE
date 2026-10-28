import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { Persona } from "./support/action-harness";
import {
  newKey,
  seedTask,
  send,
  taskState,
} from "./support/mobile-tasks-fixtures";

beforeAll(setupHarness);
afterAll(teardownHarness);

// Who may edit a task is one rule: an admin, the creator, or an assignee. The
// context tells the app what it may offer, and the routes enforce the same
// rule, so a person must be offered an action exactly when it is accepted.
const PEOPLE: readonly Persona[] = ["admin", "owner", "outsider"];

const seedEditable = () =>
  seedTask({
    assignees: [personaId("owner")],
    createdById: personaId("admin"),
  });

const offered = async (taskId: string, as: Persona) => {
  const response = await send("GET", `/api/v1/workspace/tasks/${taskId}`, {
    as,
  });
  expect(response.status).toBe(200);
  return (response.body.data as { permittedActions: readonly string[] })
    .permittedActions;
};

it("offers an edit exactly when the update route accepts it", async () => {
  for (const as of PEOPLE) {
    // eslint-disable-next-line no-await-in-loop
    const taskId = await seedEditable();
    // eslint-disable-next-line no-await-in-loop
    const actions = await offered(taskId, as);
    // eslint-disable-next-line no-await-in-loop
    const response = await send("PATCH", `/api/v1/workspace/tasks/${taskId}`, {
      as,
      body: { expectedVersion: 1, priority: "high" },
      key: newKey(),
    });

    expect([as, response.status === 200]).toEqual([
      as,
      actions.includes("update"),
    ]);
  }
});

it("offers subtasks exactly when the subtask route accepts them", async () => {
  for (const as of PEOPLE) {
    // eslint-disable-next-line no-await-in-loop
    const taskId = await seedEditable();
    // eslint-disable-next-line no-await-in-loop
    const actions = await offered(taskId, as);
    // eslint-disable-next-line no-await-in-loop
    const response = await send(
      "POST",
      `/api/v1/workspace/tasks/${taskId}/subtasks`,
      {
        as,
        body: { expectedVersion: 1, title: "Check the rule" },
        key: newKey(),
      }
    );

    expect([as, response.status === 200]).toEqual([
      as,
      actions.includes("manageSubtasks"),
    ]);
  }
});

it("refuses someone who may not edit with 403 even when the version is stale", async () => {
  const taskId = await seedEditable();
  const before = await taskState(taskId);

  const subtask = await send(
    "POST",
    `/api/v1/workspace/tasks/${taskId}/subtasks`,
    {
      as: "outsider",
      body: { expectedVersion: 99, title: "Not yours" },
      key: newKey(),
    }
  );
  const update = await send("PATCH", `/api/v1/workspace/tasks/${taskId}`, {
    as: "outsider",
    body: { expectedVersion: 99, priority: "high" },
    key: newKey(),
  });

  expect([subtask.status, update.status]).toEqual([403, 403]);
  expect(await taskState(taskId)).toEqual(before);
});
