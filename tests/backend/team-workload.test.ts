import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  TeamWorkload,
  TeamWorkloadLive,
} from "../../src/server/workload/team-workload";

const NOW = new Date("2026-10-22T12:00:00.000Z");

const view = (actorId: string) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* run() {
        const workload = yield* TeamWorkload;
        return yield* workload.view(actorId, NOW);
      }),
      TeamWorkloadLive
    )
  );

const failureCode = (actorId: string) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* run() {
        const workload = yield* TeamWorkload;
        const error = yield* Effect.flip(workload.view(actorId, NOW));
        return error.code;
      }),
      TeamWorkloadLive
    )
  );

const suffix = randomUUID().slice(0, 8);
const adminId = randomUUID();
const staffId = randomUUID();
const idleId = randomUUID();
const clientId = randomUUID();
const companyId = randomUUID();
const projectId = randomUUID();
const archivedProjectId = randomUUID();
const createdUsers = [adminId, staffId, idleId];
let taskNumber = 0;

const insertUser = async (id: string, name: string, role = "employee") => {
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [id, name, `${id}@workload.example`, role]
  );
};

const insertTask = async (options: {
  readonly assigneeId: string;
  readonly dueDate: string | null;
  readonly estimate?: string;
  readonly priority?: string;
  readonly project?: string;
  readonly status?: string;
  readonly archived?: boolean;
}) => {
  const id = randomUUID();
  taskNumber += 1;
  await authPool.query(
    `INSERT INTO task (id, "projectId", "projectTaskNumber", title, status, priority, "createdById", "dueDate", estimate, "archivedAt", "archivedById")
     VALUES ($1, $2, $3, 'Workload task', $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      options.project ?? projectId,
      taskNumber,
      options.status ?? "todo",
      options.priority ?? "medium",
      adminId,
      options.dueDate,
      options.estimate ?? null,
      options.archived ? NOW : null,
      options.archived ? adminId : null,
    ]
  );
  await authPool.query(
    'INSERT INTO task_assignee ("taskId", "userId", "assignedById") VALUES ($1, $2, $3)',
    [id, options.assigneeId, adminId]
  );
};

beforeAll(async () => {
  await insertUser(adminId, "Ada Workload", "admin");
  await insertUser(staffId, "Sam Staff");
  await insertUser(idleId, "Ida Idle");
  await authPool.query(
    'INSERT INTO client_company (id, name, "createdById") VALUES ($1, $2, $3)',
    [companyId, `Workload client ${companyId}`, adminId]
  );
  await authPool.query(
    `INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword", "clientCompanyId") VALUES ($1, 'Cleo Client', $2, $2, 'client', false, $3)`,
    [clientId, `${clientId}@workload.example`, companyId]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name, \"archivedAt\") VALUES ($1, $2, 'Workload project', NULL), ($3, $4, 'Archived workload project', now())",
    [
      projectId,
      `W${suffix.slice(0, 5)}`,
      archivedProjectId,
      `X${suffix.slice(0, 5)}`,
    ]
  );
  await insertTask({
    assigneeId: staffId,
    dueDate: "2026-10-23",
    estimate: "4h",
  });
  await insertTask({
    assigneeId: staffId,
    dueDate: "2026-10-28",
    estimate: "40h",
  });
  await insertTask({ assigneeId: staffId, dueDate: null, priority: "high" });
  await insertTask({
    assigneeId: staffId,
    dueDate: "2026-10-10",
    status: "progress",
  });
  await insertTask({
    assigneeId: staffId,
    dueDate: "2026-10-23",
    status: "done",
  });
  await insertTask({
    archived: true,
    assigneeId: staffId,
    dueDate: "2026-10-23",
  });
  await insertTask({
    assigneeId: staffId,
    dueDate: "2026-10-23",
    project: archivedProjectId,
  });
});

afterAll(async () => {
  await authPool.query('DELETE FROM task WHERE "projectId" = ANY($1::uuid[])', [
    [projectId, archivedProjectId],
  ]);
  await authPool.query("DELETE FROM project WHERE id = ANY($1::uuid[])", [
    [projectId, archivedProjectId],
  ]);
  await authPool.query('DELETE FROM "user" WHERE id = $1', [clientId]);
  await authPool.query("DELETE FROM client_company WHERE id = $1", [companyId]);
  await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
    createdUsers,
  ]);
});

it("totals each person's open tasks per week and flags overload", async () => {
  const result = await view(staffId);
  const sam = result.people.find(({ userId }) => userId === staffId);
  expect(result.weeks[0]).toBe("2026-10-19");
  expect(sam?.weeks[0]).toMatchObject({
    loadHours: 7,
    overloaded: false,
    taskCount: 2,
  });
  expect(sam?.weeks[1]).toMatchObject({
    loadHours: 40,
    overloaded: true,
    taskCount: 1,
  });
  expect(sam?.overdueCount).toBe(1);
  expect(sam?.unscheduled).toEqual({ loadHours: 4, taskCount: 1 });
  expect(result.people[0]?.userId).toBe(staffId);
});

it("lists idle teammates, but never clients", async () => {
  const result = await view(adminId);
  const ids = result.people.map(({ userId }) => userId);
  expect(ids).toContain(idleId);
  expect(ids).toContain(adminId);
  expect(ids).not.toContain(clientId);
  expect(
    result.people.find(({ userId }) => userId === idleId)?.peakLoadHours
  ).toBe(0);
});

it("refuses clients and unknown users", async () => {
  expect(await failureCode(clientId)).toBe("UNAUTHENTICATED");
  expect(await failureCode(randomUUID())).toBe("UNAUTHENTICATED");
});
