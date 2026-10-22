import { afterAll, beforeAll, expect, it } from "bun:test";

import {
  authPool,
  ids,
  replay,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

const fieldActions =
  await import("../../features/custom-fields/custom-field-actions");
const valueActions =
  await import("../../features/custom-fields/custom-field-value-actions");

beforeAll(setupHarness);
afterAll(teardownHarness);

const countRows = async (sql: string, params: unknown[]): Promise<number> => {
  const result = await authPool.query<{ n: number }>(sql, params);
  return result.rows[0]?.n ?? 0;
};

it("replays every custom field action without acting twice", async () => {
  const first = await replay(
    "createCustomFieldAction",
    "admin",
    fieldActions.createCustomFieldAction,
    {
      name: "Replay notes",
      options: [],
      projectId: ids.projectId,
      required: false,
      type: "text",
    }
  );
  const second = await replay(
    "createCustomFieldAction",
    "admin",
    fieldActions.createCustomFieldAction,
    {
      name: "Replay size",
      options: ["S", "L"],
      projectId: ids.projectId,
      required: false,
      type: "select",
    }
  );
  expect(
    await countRows(
      'SELECT count(*)::int AS n FROM custom_field WHERE "projectId" = $1',
      [ids.projectId]
    )
  ).toBe(2);

  await replay(
    "updateCustomFieldAction",
    "admin",
    fieldActions.updateCustomFieldAction,
    {
      fieldId: first.id,
      name: "Replay notes (renamed)",
      options: [],
      required: true,
    }
  );
  await replay(
    "reorderCustomFieldsAction",
    "admin",
    fieldActions.reorderCustomFieldsAction,
    { fieldIds: [second.id, first.id], projectId: ids.projectId }
  );
  const set = await replay(
    "setCustomFieldValueAction",
    "owner",
    valueActions.setCustomFieldValueAction,
    { fieldId: second.id, taskId: ids.taskId, value: "L" }
  );
  expect(set).toEqual({ changed: true });
  expect(
    await countRows(
      "SELECT count(*)::int AS n FROM activity WHERE \"taskId\" = $1 AND action = 'task.custom_field_set'",
      [ids.taskId]
    )
  ).toBe(1);
  await replay(
    "clearCustomFieldValueAction",
    "owner",
    valueActions.clearCustomFieldValueAction,
    { fieldId: second.id, taskId: ids.taskId }
  );
  await replay(
    "archiveCustomFieldAction",
    "admin",
    fieldActions.archiveCustomFieldAction,
    { fieldId: first.id }
  );
});
