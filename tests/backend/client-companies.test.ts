import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  callAs,
  ids,
  nextKey,
  personaId,
  replay,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

const clients = await import("../../features/clients/clients-actions");
const clientQueries = await import("../../features/clients/clients-queries");
const people = await import("../../features/people/people-actions");

beforeAll(setupHarness);
afterAll(async () => {
  await authPool.query('DELETE FROM bug_report WHERE "projectId" = $1', [
    ids.projectId,
  ]);
  await teardownHarness();
});

interface Receipt {
  readonly companyId: string;
  readonly version: number;
}

const createCompany = async (name: string): Promise<Receipt> =>
  await replay(
    "createClientCompanyAction",
    "admin",
    clients.createClientCompanyAction,
    {
      name: `${name} ${randomUUID().slice(0, 8)}`,
    }
  );

it("lets an admin create, rename and configure a client company", async () => {
  const created = await createCompany("Acme");
  const renamed = await replay(
    "updateClientCompanyAction",
    "admin",
    clients.updateClientCompanyAction,
    {
      companyId: created.companyId,
      expectedVersion: created.version,
      name: `Acme Renamed ${randomUUID().slice(0, 8)}`,
    }
  );
  const withProjects = await replay(
    "setClientCompanyProjectsAction",
    "admin",
    clients.setClientCompanyProjectsAction,
    {
      companyId: created.companyId,
      expectedVersion: renamed.version,
      projectIds: [ids.projectId],
    }
  );
  const withHandlers = await replay(
    "setClientCompanyHandlersAction",
    "admin",
    clients.setClientCompanyHandlersAction,
    {
      companyId: created.companyId,
      employeeIds: [personaId("owner"), personaId("outsider")],
      expectedVersion: withProjects.version,
    }
  );
  const user = await callAs("admin", clients.createClientUserAction, {
    companyId: created.companyId,
    email: `acme-${randomUUID().slice(0, 8)}@action-harness.example`,
    name: "Acme Client",
  });
  expect(user).toMatchObject({ ok: true });

  const detail = await callAs("admin", clientQueries.getClientCompany, {
    companyId: created.companyId,
  });
  if (!detail.ok) {
    throw new Error(detail.error.message);
  }
  expect(detail.data.company).toMatchObject({
    active: true,
    handlerCount: 2,
    projectCount: 1,
    userCount: 1,
    version: withHandlers.version,
  });
  expect(detail.data.users[0]).toMatchObject({
    mustChangePassword: true,
    name: "Acme Client",
  });
  const list = await callAs("admin", clientQueries.listClientCompanies, {});
  expect(list.ok && list.data.some(({ id }) => id === created.companyId)).toBe(
    true
  );
});

it("rejects a stale company version and non-employee handlers", async () => {
  const created = await createCompany("Stale");
  const stale = await callAs("admin", clients.updateClientCompanyAction, {
    companyId: created.companyId,
    expectedVersion: created.version + 5,
    idempotencyKey: nextKey(),
    name: "Never applied",
  });
  expect(stale).toMatchObject({ error: { code: "CONFLICT" }, ok: false });
  const clientHandler = await callAs(
    "admin",
    clients.setClientCompanyHandlersAction,
    {
      companyId: created.companyId,
      employeeIds: [personaId("client")],
      expectedVersion: created.version,
      idempotencyKey: nextKey(),
    }
  );
  expect(clientHandler).toMatchObject({
    error: { code: "VALIDATION_FAILED" },
    ok: false,
  });
});

it("soft-removes projects and restores them when added back", async () => {
  const created = await createCompany("Projects");
  const added = await callAs("admin", clients.setClientCompanyProjectsAction, {
    companyId: created.companyId,
    expectedVersion: created.version,
    idempotencyKey: nextKey(),
    projectIds: [ids.projectId],
  });
  if (!added.ok) {
    throw new Error(added.error.message);
  }
  const removed = await callAs(
    "admin",
    clients.setClientCompanyProjectsAction,
    {
      companyId: created.companyId,
      expectedVersion: added.data.version,
      idempotencyKey: nextKey(),
      projectIds: [],
    }
  );
  if (!removed.ok) {
    throw new Error(removed.error.message);
  }
  const rows = await authPool.query<{ removedAt: Date | null }>(
    'SELECT "removedAt" FROM client_company_project WHERE "companyId" = $1',
    [created.companyId]
  );
  expect(rows.rows).toHaveLength(1);
  expect(rows.rows[0]?.removedAt).not.toBeNull();
  const restored = await callAs(
    "admin",
    clients.setClientCompanyProjectsAction,
    {
      companyId: created.companyId,
      expectedVersion: removed.data.version,
      idempotencyKey: nextKey(),
      projectIds: [ids.projectId],
    }
  );
  expect(restored).toMatchObject({ ok: true });
  const after = await authPool.query<{ removedAt: Date | null }>(
    'SELECT "removedAt" FROM client_company_project WHERE "companyId" = $1',
    [created.companyId]
  );
  expect(after.rows).toEqual([{ removedAt: null }]);
});

it("deactivating a company deactivates its users and revokes their sessions", async () => {
  const created = await createCompany("Offboard");
  const user = await callAs("admin", clients.createClientUserAction, {
    companyId: created.companyId,
    email: `offboard-${randomUUID().slice(0, 8)}@action-harness.example`,
    name: "Offboard Client",
  });
  if (!user.ok) {
    throw new Error(user.error.message);
  }
  await authPool.query(
    'INSERT INTO session (id, token, "userId", "expiresAt", "createdAt", "updatedAt") VALUES ($1, $2, $3, now() + interval \'1 hour\', now(), now())',
    [randomUUID(), randomUUID(), user.data.id]
  );
  const deactivated = await replay(
    "deactivateClientCompanyAction",
    "admin",
    clients.deactivateClientCompanyAction,
    { companyId: created.companyId, expectedVersion: created.version }
  );
  const state = await authPool.query<{
    deactivatedAt: Date | null;
    sessions: number;
  }>(
    'SELECT "deactivatedAt", (SELECT count(*)::int FROM session WHERE "userId" = $1) AS sessions FROM "user" WHERE id = $1',
    [user.data.id]
  );
  expect(state.rows[0]?.deactivatedAt).not.toBeNull();
  expect(state.rows[0]?.sessions).toBe(0);

  const reactivateUser = await callAs(
    "admin",
    people.reactivateEmployeeAction,
    {
      employeeId: user.data.id,
      idempotencyKey: nextKey(),
    }
  );
  expect(reactivateUser).toMatchObject({
    error: { code: "CONFLICT" },
    ok: false,
  });
  const reactivated = await replay(
    "reactivateClientCompanyAction",
    "admin",
    clients.reactivateClientCompanyAction,
    { companyId: created.companyId, expectedVersion: deactivated.version }
  );
  expect(reactivated.version).toBe(deactivated.version + 1);
  const addToInactive = await callAs("admin", clients.createClientUserAction, {
    companyId: created.companyId,
    email: `late-${randomUUID().slice(0, 8)}@action-harness.example`,
    name: "Late Client",
  });
  expect(addToInactive).toMatchObject({ ok: true });
});

const insertClientBug = async (
  companyId: string,
  assigneeId: string
): Promise<string> => {
  const taskId = randomUUID();
  const bugId = randomUUID();
  const counter = await authPool.query<{ nextNumber: number }>(
    'UPDATE project_task_counter SET "nextNumber" = "nextNumber" + 1 WHERE "projectId" = $1 RETURNING "nextNumber" - 1 AS "nextNumber"',
    [ids.projectId]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, type, "createdById") VALUES ($1, $2, $3, $4, \'bug\', $5)',
    [
      taskId,
      ids.projectId,
      counter.rows[0]?.nextNumber,
      "Client bug",
      personaId("client"),
    ]
  );
  await authPool.query(
    'INSERT INTO bug_report (id, "taskId", "projectId", "reporterId", status, severity, "discoverySource", environment, component, route, "reproductionSteps", "expectedBehavior", "actualBehavior", "clientCompanyId", "clientImpact", "pickedById", "pickedAt") VALUES ($1, $2, $3, $4, \'triaged\', \'major\', \'customer_report\', \'production\', \'Portal\', \'/\', ARRAY[\'Open it\'], \'Works\', \'Breaks\', $5, \'high\', $6, now())',
    [bugId, taskId, ids.projectId, personaId("client"), companyId, assigneeId]
  );
  await authPool.query(
    'INSERT INTO task_assignee ("taskId", "userId", "assignedById") VALUES ($1, $2, $2)',
    [taskId, assigneeId]
  );
  return bugId;
};

it("flags a removed handler's open client bugs for reassignment and tells admins", async () => {
  const created = await createCompany("Handlers");
  const withHandler = await callAs(
    "admin",
    clients.setClientCompanyHandlersAction,
    {
      companyId: created.companyId,
      employeeIds: [personaId("outsider")],
      expectedVersion: created.version,
      idempotencyKey: nextKey(),
    }
  );
  if (!withHandler.ok) {
    throw new Error(withHandler.error.message);
  }
  const bugId = await insertClientBug(created.companyId, personaId("outsider"));
  const removed = await callAs(
    "admin",
    clients.setClientCompanyHandlersAction,
    {
      companyId: created.companyId,
      employeeIds: [],
      expectedVersion: withHandler.data.version,
      idempotencyKey: nextKey(),
    }
  );
  expect(removed).toMatchObject({ ok: true });
  const bug = await authPool.query<{ needsReassignment: boolean }>(
    'SELECT "needsReassignment" FROM bug_report WHERE id = $1',
    [bugId]
  );
  expect(bug.rows[0]?.needsReassignment).toBe(true);
  // Every other active admin hears about it; the acting admin already knows.
  const notices = await authPool.query<{ userId: string }>(
    'SELECT n."userId" FROM notification n JOIN bug_report b ON b."taskId" = n."taskId" WHERE b.id = $1 AND n.type = \'client_bug\'',
    [bugId]
  );
  const recipients = notices.rows.map(({ userId }) => userId);
  expect(recipients.length).toBeGreaterThan(0);
  expect(recipients).not.toContain(personaId("admin"));
});

it("flags a deactivated employee's open client bugs", async () => {
  const created = await createCompany("Departing");
  const bugId = await insertClientBug(created.companyId, personaId("owner"));
  const { flagHandlerBugsForReassignment } =
    await import("../../src/server/clients/client-handler-reassignment");
  const { db } = await import("../../src/prisma/db");
  const flagged = await db.transaction((transaction) =>
    flagHandlerBugsForReassignment(transaction, {
      actorId: personaId("admin"),
      companyId: null,
      employeeId: personaId("owner"),
      now: new Date(),
    })
  );
  expect(flagged).toBeGreaterThanOrEqual(1);
  const bug = await authPool.query<{ needsReassignment: boolean }>(
    'SELECT "needsReassignment" FROM bug_report WHERE id = $1',
    [bugId]
  );
  expect(bug.rows[0]?.needsReassignment).toBe(true);
});

it("unlocks a locked account", async () => {
  await authPool.query(
    'UPDATE "user" SET "failedLoginCount" = 5, "lockedUntil" = now() + interval \'15 minutes\' WHERE id = $1',
    [personaId("client")]
  );
  const unlocked = await callAs("admin", clients.unlockUserAction, {
    userId: personaId("client"),
  });
  expect(unlocked).toMatchObject({ ok: true });
  const row = await authPool.query<{
    failedLoginCount: number;
    lockedUntil: Date | null;
  }>('SELECT "failedLoginCount", "lockedUntil" FROM "user" WHERE id = $1', [
    personaId("client"),
  ]);
  expect(row.rows[0]).toEqual({ failedLoginCount: 0, lockedUntil: null });
});

it("refuses to change a client account's role", async () => {
  const changed = await callAs("admin", people.changeEmployeeRoleAction, {
    employeeId: personaId("client"),
    idempotencyKey: nextKey(),
    role: "employee",
  });
  expect(changed).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
});
