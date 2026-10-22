import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { parseCsv } from "../../src/server/tasks/csv";
import { TaskCsv, TaskCsvLive } from "../../src/server/tasks/task-csv";
import type { TaskCsvFilters } from "../../src/server/tasks/task-csv";

const actorId = randomUUID();
const projectId = randomUUID();
const otherProjectId = randomUUID();
const suffix = randomUUID().slice(0, 5).toUpperCase();
const key = `CX${suffix}`;
const otherKey = `CY${suffix}`;
const fieldId = {
  archived: randomUUID(),
  billable: randomUUID(),
  budget: randomUUID(),
  notes: randomUUID(),
  other: randomUUID(),
  size: randomUUID(),
};
const taskId = {
  empty: randomUUID(),
  filled: randomUUID(),
  other: randomUUID(),
};

const exportRows = async (filters: TaskCsvFilters) => {
  const text = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* run() {
        const service = yield* TaskCsv;
        return yield* service.exportTasks(actorId, filters, "2026-06-01");
      }),
      TaskCsvLive
    )
  );
  const parsed = parseCsv(text);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  const [header = [], ...records] = parsed.rows;
  return { header, records };
};

const insertField = (
  id: string,
  project: string,
  name: string,
  type: string,
  position: number,
  extra: { archived?: boolean; options?: string[] } = {}
) =>
  authPool.query(
    'INSERT INTO custom_field (id, "projectId", name, type, options, position, "archivedAt") VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [
      id,
      project,
      name,
      type,
      extra.options ? JSON.stringify(extra.options) : null,
      position,
      extra.archived ? new Date() : null,
    ]
  );

const insertValue = (
  task: string,
  field: string,
  column: string,
  value: string | number | boolean
) =>
  authPool.query(
    `INSERT INTO custom_field_value (id, "taskId", "fieldId", "${column}") VALUES ($1, $2, $3, $4)`,
    [randomUUID(), task, field, value]
  );

beforeAll(async () => {
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, \'Csv Fields Actor\', $2, $2, \'employee\', false)',
    [actorId, `${actorId}@custom-field-csv.example`]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, 'Csv fields one'), ($3, $4, 'Csv fields two')",
    [projectId, key, otherProjectId, otherKey]
  );
  await authPool.query(
    "INSERT INTO task (id, \"projectId\", \"projectTaskNumber\", title, \"createdById\") VALUES ($1, $2, 1, 'Filled', $4), ($3, $2, 2, 'Empty', $4), ($5, $6, 1, 'Elsewhere', $4)",
    [
      taskId.filled,
      projectId,
      taskId.empty,
      actorId,
      taskId.other,
      otherProjectId,
    ]
  );
  await insertField(fieldId.notes, projectId, "Notes", "text", 0);
  await insertField(fieldId.budget, projectId, "Budget", "number", 1);
  await insertField(fieldId.size, projectId, "Size", "select", 2, {
    options: ["S", "L"],
  });
  await insertField(fieldId.billable, projectId, "Billable", "checkbox", 3);
  await insertField(fieldId.archived, projectId, "Retired", "text", 4, {
    archived: true,
  });
  await insertField(fieldId.other, otherProjectId, "Region", "text", 0);
  await insertValue(taskId.filled, fieldId.notes, "textValue", "=SUM(A1)");
  await insertValue(taskId.filled, fieldId.budget, "numberValue", -12.5);
  await insertValue(taskId.filled, fieldId.size, "textValue", "L");
  await insertValue(taskId.filled, fieldId.billable, "boolValue", true);
  await insertValue(taskId.filled, fieldId.archived, "textValue", "old");
  await insertValue(taskId.other, fieldId.other, "textValue", "EMEA");
});

afterAll(async () => {
  await authPool.query('DELETE FROM task WHERE "projectId" = ANY($1::uuid[])', [
    [projectId, otherProjectId],
  ]);
  await authPool.query("DELETE FROM project WHERE id = ANY($1::uuid[])", [
    [projectId, otherProjectId],
  ]);
  await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
});

it("adds one column per active field after the standard columns", async () => {
  const { header, records } = await exportRows({ projectId });
  expect(header.slice(10)).toEqual([
    `custom:${key}:Notes`,
    `custom:${key}:Budget`,
    `custom:${key}:Size`,
    `custom:${key}:Billable`,
  ]);
  const filled = records.find((row) => row[2] === "Filled");
  const empty = records.find((row) => row[2] === "Empty");
  // The formula is neutralised with a leading apostrophe by the shared escaper.
  expect(filled?.slice(10)).toEqual(["'=SUM(A1)", "-12.5", "L", "true"]);
  expect(empty?.slice(10)).toEqual(["", "", "", ""]);
});

it("lists every project's fields in a combined export, blank where a task has none", async () => {
  const { header, records } = await exportRows({});
  const custom = header.filter((name) => name.startsWith("custom:"));
  expect(custom).toContain(`custom:${otherKey}:Region`);
  expect(custom).toContain(`custom:${key}:Notes`);
  const regionColumn = header.indexOf(`custom:${otherKey}:Region`);
  const notesColumn = header.indexOf(`custom:${key}:Notes`);
  const elsewhere = records.find((row) => row[2] === "Elsewhere");
  expect(elsewhere?.[regionColumn]).toBe("EMEA");
  expect(elsewhere?.[notesColumn]).toBe("");
});

it("leaves archived fields out of the export", async () => {
  const { header } = await exportRows({ projectId });
  expect(header.some((name) => name.endsWith(":Retired"))).toBe(false);
});
