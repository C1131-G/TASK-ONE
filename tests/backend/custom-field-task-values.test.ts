import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  callAs,
  ids,
  nextKey,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { Persona } from "./support/action-harness";

const actions =
  await import("../../features/custom-fields/custom-field-actions");
const valueActions =
  await import("../../features/custom-fields/custom-field-value-actions");
const queries =
  await import("../../features/custom-fields/custom-field-queries");

const fieldIds: Record<string, string> = {};

const defineField = async (
  name: string,
  type: string,
  extra: Record<string, unknown> = {}
) => {
  const created = await callAs("admin", actions.createCustomFieldAction, {
    idempotencyKey: nextKey(),
    name,
    options: [],
    projectId: ids.projectId,
    required: false,
    type,
    ...extra,
  });
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  fieldIds[name] = created.data.id;
};

const setValue = (
  persona: Persona,
  name: string,
  value: unknown,
  taskId = ids.taskId
) =>
  callAs(persona, valueActions.setCustomFieldValueAction, {
    fieldId: fieldIds[name],
    idempotencyKey: nextKey(),
    taskId,
    value,
  });

const clearValue = (persona: Persona, name: string, taskId = ids.taskId) =>
  callAs(persona, valueActions.clearCustomFieldValueAction, {
    fieldId: fieldIds[name],
    idempotencyKey: nextKey(),
    taskId,
  });

const readFields = async (persona: Persona = "owner", taskId = ids.taskId) => {
  const result = await callAs(persona, queries.getTaskCustomFields, {
    taskId,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.data;
};

const valueOf = async (name: string) => {
  const { fields } = await readFields();
  return fields.find((field) => field.name === name)?.value;
};

const customFieldActivity = async (taskId = ids.taskId) => {
  const rows = await authPool.query<{ action: string }>(
    'SELECT action FROM activity WHERE "taskId" = $1 AND action LIKE \'task.custom_field_%\' ORDER BY "createdAt"',
    [taskId]
  );
  return rows.rows.map(({ action }) => action);
};

beforeAll(async () => {
  await setupHarness();
  await defineField("Notes", "text");
  await defineField("Budget", "number");
  await defineField("Size", "select", { options: ["Small", "Large"] });
  await defineField("Review by", "date");
  await defineField("Billable", "checkbox");
  await defineField("Client code", "text", { required: true });
});
afterAll(teardownHarness);

it("stores a value of each type for the task owner and reads it back", async () => {
  expect(await setValue("owner", "Notes", "  Needs a call  ")).toMatchObject({
    data: { changed: true },
    ok: true,
  });
  await setValue("owner", "Budget", 1250.5);
  await setValue("owner", "Size", "Large");
  await setValue("owner", "Review by", "2026-03-01");
  await setValue("owner", "Billable", false);
  const { canEdit, fields } = await readFields();
  expect(canEdit).toBe(true);
  expect(fields.map(({ name, value }) => [name, value])).toEqual([
    ["Notes", "Needs a call"],
    ["Budget", 1250.5],
    ["Size", "Large"],
    ["Review by", "2026-03-01"],
    ["Billable", false],
    ["Client code", null],
  ]);
  const stored = await authPool.query(
    'SELECT "textValue", "numberValue", "dateValue", "boolValue" FROM custom_field_value WHERE "taskId" = $1 AND "fieldId" = $2',
    [ids.taskId, fieldIds["Budget"]]
  );
  expect(stored.rows[0]).toMatchObject({
    boolValue: null,
    numberValue: 1250.5,
    textValue: null,
  });
  expect(personaId("owner")).not.toBe(randomUUID());
});

it("records an activity entry per change and none for a repeat", async () => {
  const logged = await customFieldActivity();
  const before = logged.length;
  expect(before).toBe(5);
  const repeat = await setValue("owner", "Size", "Large");
  expect(repeat).toMatchObject({ data: { changed: false }, ok: true });
  expect(await customFieldActivity()).toHaveLength(before);
  const changed = await setValue("owner", "Size", "Small");
  expect(changed).toMatchObject({ data: { changed: true }, ok: true });
  expect(await customFieldActivity()).toHaveLength(before + 1);
  const key = nextKey();
  const send = () =>
    callAs("owner", valueActions.setCustomFieldValueAction, {
      fieldId: fieldIds["Notes"],
      idempotencyKey: key,
      taskId: ids.taskId,
      value: "Second note",
    });
  const first = await send();
  const replayed = await send();
  expect(first).toMatchObject({ data: { changed: true }, ok: true });
  expect(replayed).toMatchObject({ data: { changed: true }, ok: true });
  expect(await customFieldActivity()).toHaveLength(before + 2);
});

it("refuses a value that does not fit the field's type", async () => {
  const rejected = [
    await setValue("owner", "Budget", "lots"),
    await setValue("owner", "Size", "Medium"),
    await setValue("owner", "Review by", "2026-02-30"),
    await setValue("owner", "Billable", "yes"),
    await setValue("owner", "Notes", "n".repeat(501)),
    await setValue("owner", "Notes", "   "),
  ];
  for (const result of rejected) {
    expect(result).toMatchObject({
      error: { code: "VALIDATION_FAILED" },
      ok: false,
    });
  }
  expect(await valueOf("Budget")).toBe(1250.5);
});

it("clears a value, tolerates clearing it again, and keeps required values", async () => {
  expect(await clearValue("owner", "Review by")).toMatchObject({
    data: { changed: true },
    ok: true,
  });
  expect(await valueOf("Review by")).toBeNull();
  expect(await clearValue("owner", "Review by")).toMatchObject({
    data: { changed: false },
    ok: true,
  });
  await setValue("owner", "Client code", "ACME-1");
  expect(await clearValue("owner", "Client code")).toMatchObject({
    error: { code: "VALIDATION_FAILED" },
    ok: false,
  });
  expect(await valueOf("Client code")).toBe("ACME-1");
  const rows = await authPool.query(
    'SELECT 1 FROM custom_field_value WHERE "taskId" = $1 AND "fieldId" = $2',
    [ids.taskId, fieldIds["Review by"]]
  );
  expect(rows.rowCount).toBe(0);
});

it("lets an administrator edit any task but refuses an unrelated employee", async () => {
  expect(await setValue("admin", "Notes", "Admin note")).toMatchObject({
    ok: true,
  });
  expect(await setValue("outsider", "Notes", "Nope")).toMatchObject({
    error: { code: "FORBIDDEN" },
    ok: false,
  });
  expect(await clearValue("outsider", "Notes")).toMatchObject({
    error: { code: "FORBIDDEN" },
    ok: false,
  });
  expect(await valueOf("Notes")).toBe("Admin note");
  const view = await readFields("outsider");
  expect(view.canEdit).toBe(false);
  expect(view.fields).toHaveLength(6);
});

it("refuses writes to archived tasks, other projects' fields and archived fields", async () => {
  const archivedTask = await setValue(
    "owner",
    "Notes",
    "Late",
    ids.archivedTaskId
  );
  expect(archivedTask).toMatchObject({
    error: { code: "FORBIDDEN" },
    ok: false,
  });
  const otherProjectId = randomUUID();
  const otherTaskId = randomUUID();
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, 'Harness other fields project')",
    [otherProjectId, `OF${otherProjectId.slice(0, 5).toUpperCase()}`]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, 1, $3, $4)',
    [otherTaskId, otherProjectId, "Other project task", personaId("owner")]
  );
  expect(
    await setValue("owner", "Notes", "Wrong project", otherTaskId)
  ).toMatchObject({ error: { code: "NOT_FOUND" }, ok: false });
  const archived = await callAs("admin", actions.archiveCustomFieldAction, {
    fieldId: fieldIds["Budget"],
    idempotencyKey: nextKey(),
  });
  expect(archived).toMatchObject({ ok: true });
  expect(await setValue("owner", "Budget", 5)).toMatchObject({
    error: { code: "NOT_FOUND" },
    ok: false,
  });
});

it("hides an archived field but keeps what was stored for it", async () => {
  const { fields } = await readFields();
  const names = fields.map(({ name }) => name);
  expect(names).not.toContain("Budget");
  const kept = await authPool.query(
    'SELECT "numberValue" FROM custom_field_value WHERE "taskId" = $1 AND "fieldId" = $2',
    [ids.taskId, fieldIds["Budget"]]
  );
  expect(kept.rows[0]?.numberValue).toBe(1250.5);
});

it("removes a task's values when the task is deleted, and a project's fields with the project", async () => {
  const projectId = randomUUID();
  const taskId = randomUUID();
  const fieldId = randomUUID();
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, 'Harness cascade project')",
    [projectId, `CC${projectId.slice(0, 5).toUpperCase()}`]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, 1, $3, $4)',
    [taskId, projectId, "Cascade task", personaId("owner")]
  );
  await authPool.query(
    "INSERT INTO custom_field (id, \"projectId\", name, type) VALUES ($1, $2, 'Cascade', 'text')",
    [fieldId, projectId]
  );
  await authPool.query(
    'INSERT INTO custom_field_value (id, "taskId", "fieldId", "textValue") VALUES ($1, $2, $3, \'x\')',
    [randomUUID(), taskId, fieldId]
  );
  await authPool.query("DELETE FROM task WHERE id = $1", [taskId]);
  const valueCount = () =>
    authPool.query(
      'SELECT count(*)::int AS n FROM custom_field_value WHERE "fieldId" = $1',
      [fieldId]
    );
  const remaining = await valueCount();
  expect(remaining.rows[0]?.n).toBe(0);
  await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
  const fields = await authPool.query(
    "SELECT 1 FROM custom_field WHERE id = $1",
    [fieldId]
  );
  expect(fields.rowCount).toBe(0);
});
