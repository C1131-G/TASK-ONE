import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { TaskCsv, TaskCsvLive } from "../../src/server/tasks/task-csv";
import type { TaskCsvFilters } from "../../src/server/tasks/task-csv";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

const actorId = randomUUID();
const teammateId = randomUUID();
const idleUserId = randomUUID();
const projectId = randomUUID();
const otherProjectId = randomUUID();
const archivedProjectId = randomUUID();
const teammateEmail = `${teammateId}@task-csv.example`;
const suffix = randomUUID().slice(0, 5);
const startedAt = new Date();

const csv = <Value>(
  program: (service: TaskCsv["Service"]) => Effect.Effect<Value, unknown>
) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* run() {
        return yield* program(yield* TaskCsv);
      }),
      TaskCsvLive
    )
  );

const failure = (
  program: (service: TaskCsv["Service"]) => Effect.Effect<unknown, unknown>
) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* run() {
        return yield* Effect.flip(program(yield* TaskCsv));
      }),
      TaskCsvLive
    )
  );

const exportRows = async (filters: TaskCsvFilters = {}) => {
  const text = await csv((service) =>
    service.exportTasks(actorId, filters, "2026-06-01")
  );
  return text.trimEnd().split("\r\n");
};

const insertUser = (id: string, name: string, extra = "") =>
  authPool.query(
    `INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword"${extra ? ', "deactivatedAt", "deactivatedById"' : ""}) VALUES ($1, $2, $3, $3, 'employee', false${extra ? ", now(), $4" : ""})`,
    extra
      ? [id, name, `${id}@task-csv.example`, extra]
      : [id, name, `${id}@task-csv.example`]
  );

beforeAll(async () => {
  await insertUser(actorId, "Csv Actor");
  await insertUser(teammateId, "Csv Teammate");
  await insertUser(idleUserId, "Csv Idle", actorId);
  for (const [id, name, key] of [
    [projectId, "Csv project", `C${suffix}`],
    [otherProjectId, "Csv other", `D${suffix}`],
  ] as const) {
    // eslint-disable-next-line no-await-in-loop
    await authPool.query(
      "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
      [id, key, name]
    );
  }
  await authPool.query(
    'INSERT INTO project (id, key, name, "archivedAt") VALUES ($1, $2, $3, now())',
    [archivedProjectId, `E${suffix}`, "Csv archived"]
  );
  await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* seed() {
        const work = yield* WorkManagement;
        const base = { assigneeIds: [] as string[], description: null };
        yield* work.createTask(actorId, {
          ...base,
          assigneeIds: [teammateId],
          description: 'Say "hi", then\nleave',
          dueDate: "2026-05-01",
          priority: "high",
          projectId,
          title: "=HYPERLINK(1)",
        });
        yield* work.createTask(actorId, {
          ...base,
          dueDate: "2026-07-01",
          priority: "low",
          projectId,
          title: "Later work",
        });
        yield* work.createTask(actorId, {
          ...base,
          dueDate: null,
          priority: "medium",
          projectId: otherProjectId,
          title: "Other project work",
        });
      }),
      WorkManagementLive
    )
  );
});

afterAll(async () => {
  // Assigning work queues push jobs; remove the ones this file created.
  await authPool.query('DELETE FROM job WHERE "createdAt" >= $1', [startedAt]);
  const users = [actorId, teammateId, idleUserId];
  await authPool.query(
    'DELETE FROM notification WHERE "userId" = ANY($1::text[])',
    [users]
  );
  await authPool.query(
    'DELETE FROM activity WHERE "actorId" = ANY($1::text[])',
    [users]
  );
  await authPool.query('DELETE FROM task WHERE "projectId" = ANY($1::uuid[])', [
    [projectId, otherProjectId, archivedProjectId],
  ]);
  await authPool.query("DELETE FROM project WHERE id = ANY($1::uuid[])", [
    [projectId, otherProjectId, archivedProjectId],
  ]);
  await authPool.query('DELETE FROM "user" WHERE id = $1', [idleUserId]);
  await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
    [actorId, teammateId],
  ]);
});

it("exports tasks with a header row and neutralised formulas and quotes", async () => {
  const lines = await exportRows({ projectId });
  expect(lines[0]).toBe(
    "project,number,title,description,status,priority,start_date,due_date,assignees,created_at"
  );
  expect(lines).toHaveLength(3);
  const joined = lines.join("\r\n");
  expect(joined).toContain("'=HYPERLINK(1)");
  expect(joined).toContain('"Say ""hi"", then\nleave"');
  expect(joined).toContain(teammateEmail);
});

it("applies the same filters the task page offers", async () => {
  const titles = async (filters: TaskCsvFilters) => {
    const lines = await exportRows({ projectId, ...filters });
    return lines.slice(1).map((line) => line.split(",")[2]);
  };
  expect(await titles({ priority: "low" })).toEqual(["Later work"]);
  expect(await titles({ overdue: true })).toEqual(["'=HYPERLINK(1)"]);
  expect(await titles({ q: "later" })).toEqual(["Later work"]);
  expect(await titles({ status: "done" })).toEqual([]);
  const everywhere = await exportRows({});
  expect(everywhere.join("\n")).toContain("Other project work");
});

it("leaves out archived tasks and tasks in archived projects", async () => {
  const archivedTask = randomUUID();
  await authPool.query(
    `INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById", "archivedAt", "archivedById") VALUES ($1, $2, 900, 'Archived task', $3, now(), $3)`,
    [archivedTask, projectId, actorId]
  );
  try {
    const lines = await exportRows({ projectId });
    expect(lines.join("\n")).not.toContain("Archived task");
  } finally {
    await authPool.query("DELETE FROM task WHERE id = $1", [archivedTask]);
  }
});

it("refuses accounts that cannot use the workspace", async () => {
  const error = await failure((service) =>
    service.exportTasks(idleUserId, {}, "2026-06-01")
  );
  expect(error).toMatchObject({ code: "UNAUTHENTICATED" });
  const importError = await failure((service) =>
    service.importTasks(idleUserId, projectId, "title\nX\n")
  );
  expect(importError).toMatchObject({ code: "UNAUTHENTICATED" });
});

it("imports valid rows into the project in one go", async () => {
  const result = await csv((service) =>
    service.importTasks(
      actorId,
      otherProjectId,
      `title,status,priority,due_date,assignees,description\r\nImported one,review,urgent,2026-09-09,${teammateEmail.toUpperCase()},"Line 1\nLine 2"\r\nImported two,,,,,\r\n`
    )
  );
  expect(result).toEqual({ created: 2, errors: [] });
  const rows = await authPool.query<{
    description: string | null;
    dueDate: string | null;
    priority: string;
    projectTaskNumber: number;
    status: string;
    title: string;
  }>(
    'SELECT title, status, priority, "dueDate"::text AS "dueDate", description, "projectTaskNumber" FROM task WHERE "projectId" = $1 AND title LIKE \'Imported%\' ORDER BY "projectTaskNumber"',
    [otherProjectId]
  );
  expect(
    rows.rows.map(({ title, status, priority }) => [title, status, priority])
  ).toEqual([
    ["Imported one", "review", "urgent"],
    ["Imported two", "todo", "none"],
  ]);
  expect(rows.rows[0]?.dueDate).toBe("2026-09-09");
  expect(rows.rows[0]?.description).toContain("Line 1");
  const [firstRow, secondRow] = rows.rows;
  expect(secondRow?.projectTaskNumber).toBe(
    (firstRow?.projectTaskNumber ?? 0) + 1
  );
  const assignees = await authPool.query(
    'SELECT 1 FROM task_assignee ta JOIN task t ON t.id = ta."taskId" WHERE t."projectId" = $1 AND t.title = \'Imported one\' AND ta."userId" = $2',
    [otherProjectId, teammateId]
  );
  expect(assignees.rowCount).toBe(1);
});

it("creates nothing when any row is invalid and reports each problem", async () => {
  const before = await authPool.query(
    'SELECT count(*)::int AS n FROM task WHERE "projectId" = $1',
    [projectId]
  );
  const result = await csv((service) =>
    service.importTasks(
      actorId,
      projectId,
      "title,priority,assignees\nGood row,high,\nBad priority,huge,\nUnknown person,low,nobody@nowhere.example\n"
    )
  );
  expect(result.created).toBe(0);
  expect(result.errors.map(({ column, line }) => [line, column])).toEqual([
    [3, "priority"],
    [4, "assignees"],
  ]);
  const after = await authPool.query(
    'SELECT count(*)::int AS n FROM task WHERE "projectId" = $1',
    [projectId]
  );
  expect(after.rows[0]?.n).toBe(before.rows[0]?.n);
});

it("rejects imports into missing or archived projects", async () => {
  expect(
    await failure((service) =>
      service.importTasks(actorId, randomUUID(), "title\nX\n")
    )
  ).toMatchObject({ code: "NOT_FOUND" });
  expect(
    await failure((service) =>
      service.importTasks(actorId, archivedProjectId, "title\nX\n")
    )
  ).toMatchObject({ code: "NOT_FOUND" });
});

it("reports file-level problems without touching the database", async () => {
  const result = await csv((service) =>
    service.importTasks(actorId, projectId, "status\ntodo\n")
  );
  expect(result.created).toBe(0);
  expect(result.errors[0]).toMatchObject({ line: 1 });
});
