import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  callAs,
  ids,
  nextKey,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

const fieldActions =
  await import("../../features/custom-fields/custom-field-actions");
const valueActions =
  await import("../../features/custom-fields/custom-field-value-actions");
const queries =
  await import("../../features/custom-fields/custom-field-queries");
const taskActions = await import("../../features/tasks/tasks-actions");
const projectActions = await import("../../features/projects/projects-actions");

const MAX_FIELDS = 20;
const fieldIds: Record<string, string> = {};

const defineField = async (
  name: string,
  type: string,
  options: string[] = [],
  required = false
) => {
  const created = await callAs("admin", fieldActions.createCustomFieldAction, {
    idempotencyKey: nextKey(),
    name,
    options,
    projectId: ids.projectId,
    required,
    type,
  });
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  fieldIds[name] = created.data.id;
};

const setValue = async (name: string, value: unknown, taskId = ids.taskId) => {
  const result = await callAs("owner", valueActions.setCustomFieldValueAction, {
    fieldId: fieldIds[name],
    idempotencyKey: nextKey(),
    taskId,
    value,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
};

const duplicateTask = async (taskId = ids.taskId) => {
  const row = await authPool.query<{ version: number }>(
    "SELECT version FROM task WHERE id = $1",
    [taskId]
  );
  const result = await callAs("owner", taskActions.duplicateTaskAction, {
    expectedVersion: row.rows[0]?.version,
    idempotencyKey: nextKey(),
    taskId,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.data as { id: string };
};

const duplicateProject = async (name: string) => {
  const result = await callAs("admin", projectActions.duplicateProjectAction, {
    idempotencyKey: nextKey(),
    key: `D${randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`,
    name,
    sourceProjectId: ids.projectId,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.data as { id: string };
};

const tableOf = async (projectId: string) => {
  const result = await callAs("admin", queries.getProjectCustomFieldTable, {
    projectId,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.data;
};

const activityOf = async (where: string, id: string) => {
  const rows = await authPool.query<{
    action: string;
    details: Record<string, unknown>;
  }>(
    `SELECT action, details FROM activity WHERE "${where}" = $1 ORDER BY "createdAt"`,
    [id]
  );
  return rows.rows;
};

beforeAll(async () => {
  await setupHarness();
  await defineField("Budget", "number");
  await defineField("Size", "select", ["Small", "Large"], true);
  await defineField("Retired", "text");
  await defineField("Unset", "date");
  await setValue("Budget", 12.5);
  await setValue("Size", "Large");
  await setValue("Retired", "old");
  const archived = await callAs(
    "admin",
    fieldActions.archiveCustomFieldAction,
    {
      fieldId: fieldIds["Retired"],
      idempotencyKey: nextKey(),
    }
  );
  if (!archived.ok) {
    throw new Error(archived.error.message);
  }
});
afterAll(teardownHarness);

it("copies a task's values of active fields onto its duplicate", async () => {
  const copy = await duplicateTask();
  const { fields, values } = await tableOf(ids.projectId);
  expect(fields.map(({ name }) => name)).toEqual(["Budget", "Size", "Unset"]);
  expect(values[copy.id]).toEqual({
    [fieldIds["Budget"] ?? ""]: 12.5,
    [fieldIds["Size"] ?? ""]: "Large",
  });
  expect(values[ids.taskId]).toEqual(values[copy.id]);
});

it("leaves archived field values off the copy, even though they are stored", async () => {
  const copy = await duplicateTask();
  const stored = await authPool.query(
    'SELECT 1 FROM custom_field_value WHERE "taskId" = $1 AND "fieldId" = $2',
    [copy.id, fieldIds["Retired"]]
  );
  expect(stored.rowCount).toBe(0);
});

it("records one activity entry on the copy for each value it received", async () => {
  const copy = await duplicateTask();
  const entries = await activityOf("taskId", copy.id);
  const sets = entries.filter(
    ({ action }) => action === "task.custom_field_set"
  );
  expect(sets.map(({ details }) => details["name"]).toSorted()).toEqual([
    "Budget",
    "Size",
  ]);
  expect(entries.some(({ action }) => action === "task.duplicated")).toBe(true);
});

it("duplicates a task without values as before", async () => {
  await authPool.query('DELETE FROM custom_field_value WHERE "taskId" = $1', [
    ids.taskId,
  ]);
  const copy = await duplicateTask();
  const stored = await authPool.query(
    'SELECT 1 FROM custom_field_value WHERE "taskId" = $1',
    [copy.id]
  );
  expect(stored.rowCount).toBe(0);
  const entries = await activityOf("taskId", copy.id);
  const sets = entries.filter(
    ({ action }) => action === "task.custom_field_set"
  );
  expect(sets).toHaveLength(0);
  await setValue("Budget", 12.5);
  await setValue("Size", "Large");
});

// "title: field=value, ..." for every live task, so a project and its copy can
// be compared without knowing which ids the copy's tasks received.
const valueSummary = async (projectId: string): Promise<string[]> => {
  const { fields, values } = await tableOf(projectId);
  const tasks = await authPool.query<{ id: string; title: string }>(
    'SELECT id, title FROM task WHERE "projectId" = $1 AND "archivedAt" IS NULL',
    [projectId]
  );
  return tasks.rows
    .map(({ id, title }) => {
      const cells = fields
        .flatMap(({ id: fieldId, name }) => {
          const value = values[id]?.[fieldId];
          return value === undefined ? [] : [`${name}=${value}`];
        })
        .join(", ");
      return `${title}: ${cells}`;
    })
    .toSorted();
};

it("copies the active field definitions and values onto a duplicated project", async () => {
  const copy = await duplicateProject("Harness copy with fields");
  const source = await tableOf(ids.projectId);
  const duplicated = await tableOf(copy.id);
  const shape = ({
    name,
    options,
    required,
    type,
  }: (typeof source.fields)[number]) => ({ name, options, required, type });
  expect(duplicated.fields.map(shape)).toEqual(source.fields.map(shape));
  expect(duplicated.fields.map(({ position }) => position)).toEqual([0, 1, 2]);
  for (const field of duplicated.fields) {
    expect(source.fields.some(({ id }) => id === field.id)).toBe(false);
    expect(field.projectId).toBe(copy.id);
  }
  const summary = await valueSummary(copy.id);
  expect(summary).toContain("Owned task: Budget=12.5, Size=Large");
  expect(summary).toEqual(await valueSummary(ids.projectId));
});

it("keeps archived fields, and archived tasks' values, out of a duplicated project", async () => {
  await authPool.query(
    'INSERT INTO custom_field_value (id, "taskId", "fieldId", "numberValue") VALUES ($1, $2, $3, 1)',
    [randomUUID(), ids.archivedTaskId, fieldIds["Budget"]]
  );
  const copy = await duplicateProject("Harness copy without archived");
  const names = await authPool.query<{ name: string }>(
    'SELECT name FROM custom_field WHERE "projectId" = $1',
    [copy.id]
  );
  expect(names.rows.map(({ name }) => name).toSorted()).toEqual([
    "Budget",
    "Size",
    "Unset",
  ]);
  const archivedCopies = await authPool.query(
    'SELECT v.id FROM custom_field_value v JOIN task t ON t.id = v."taskId" WHERE t."projectId" = $1 AND t.title = $2',
    [copy.id, "Archived task"]
  );
  expect(archivedCopies.rowCount).toBe(0);
});

it("records the copied field and value counts on the project's activity", async () => {
  const copy = await duplicateProject("Harness copy activity");
  const copiedValues = await authPool.query(
    'SELECT v.id FROM custom_field_value v JOIN task t ON t.id = v."taskId" WHERE t."projectId" = $1',
    [copy.id]
  );
  const entries = await activityOf("projectId", copy.id);
  const duplicated = entries.find(
    ({ action }) => action === "project.duplicated"
  );
  expect(duplicated?.details).toMatchObject({
    customFieldCount: 3,
    customValueCount: copiedValues.rowCount,
  });
  expect(copiedValues.rowCount).toBeGreaterThan(0);
});

it("copies a full set of twenty fields and keeps the project at its limit", async () => {
  const room = MAX_FIELDS - 3;
  for (let index = 0; index < room; index += 1) {
    // Sequential: each field takes the next position.
    // eslint-disable-next-line no-await-in-loop
    await defineField(`Filler ${index}`, "text");
  }
  const copy = await duplicateProject("Harness copy at limit");
  const { fields } = await tableOf(copy.id);
  expect(fields).toHaveLength(MAX_FIELDS);
  const extra = await callAs("admin", fieldActions.createCustomFieldAction, {
    idempotencyKey: nextKey(),
    name: "One too many",
    options: [],
    projectId: copy.id,
    required: false,
    type: "text",
  });
  expect(extra).toMatchObject({ ok: false });
});
