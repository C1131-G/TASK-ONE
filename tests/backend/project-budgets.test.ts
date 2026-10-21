import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  ProjectBudgets,
  ProjectBudgetsLive,
  evaluateBudgetAlerts,
} from "../../src/server/budgets/project-budgets";
import type { BudgetInput } from "../../src/server/budgets/project-budgets";
import {
  TimeTracking,
  TimeTrackingLive,
} from "../../src/server/time/time-tracking";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

const budgets = <Value, Failure>(
  program: (service: ProjectBudgets["Service"]) => Effect.Effect<Value, Failure>
) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* run() {
        return yield* program(yield* ProjectBudgets);
      }),
      ProjectBudgetsLive
    )
  );

const failureCode = (
  program: (
    service: ProjectBudgets["Service"]
  ) => Effect.Effect<unknown, { readonly code: string }>
) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* run() {
        const error = yield* Effect.flip(program(yield* ProjectBudgets));
        return error.code;
      }),
      ProjectBudgetsLive
    )
  );

const suffix = randomUUID().slice(0, 8);
const adminId = randomUUID();
const leadId = randomUUID();
const memberId = randomUUID();
const outsiderId = randomUUID();
const clientId = randomUUID();
const companyId = randomUUID();
const projectId = randomUUID();
const otherProjectId = randomUUID();
let taskId = "";
const createdUsers = [adminId, leadId, memberId, outsiderId, clientId];

const OCTOBER = new Date("2026-10-15T12:00:00.000Z");
const NOVEMBER = new Date("2026-11-03T12:00:00.000Z");

const retainer: BudgetInput = {
  billableOnly: false,
  budgetMinutes: 600,
  currency: "EUR",
  hourlyRateCents: 9000,
  kind: "retainer",
  warningPercent: 80,
};

const insertUser = async (id: string, name: string, role = "employee") => {
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [id, name, `${id}@budgets.example`, role]
  );
};

const logMinutes = async (
  minutes: number,
  workDate: string,
  billable = false
) => {
  await authPool.query(
    'INSERT INTO time_entry (id, "userId", "taskId", "workDate", minutes, billable) VALUES ($1, $2, $3, $4, $5, $6)',
    [randomUUID(), memberId, taskId, workDate, minutes, billable]
  );
};

const clearEntries = async () => {
  await authPool.query('DELETE FROM time_entry WHERE "taskId" = $1', [taskId]);
  await authPool.query(
    'DELETE FROM project_budget_alert WHERE "projectId" = $1',
    [projectId]
  );
};

const notificationsFor = async (userId: string) => {
  const result = await authPool.query<{
    text: string;
    type: string;
    projectId: string;
  }>(
    'SELECT text, type, "projectId" FROM notification WHERE "userId" = $1 AND "projectId" = $2 ORDER BY "createdAt"',
    [userId, projectId]
  );
  return result.rows;
};

const notificationCount = async (userId: string): Promise<number> => {
  const rows = await notificationsFor(userId);
  return rows.length;
};

beforeAll(async () => {
  await insertUser(adminId, "Ada Budget", "admin");
  await insertUser(leadId, "Lee Lead");
  await insertUser(memberId, "Mia Member");
  await insertUser(outsiderId, "Otto Outsider");
  await authPool.query(
    'INSERT INTO client_company (id, name, "createdById") VALUES ($1, $2, $3)',
    [companyId, `Budget client ${companyId}`, adminId]
  );
  await authPool.query(
    `INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword", "clientCompanyId") VALUES ($1, 'Cleo Client', $2, $2, 'client', false, $3)`,
    [clientId, `${clientId}@budgets.example`, companyId]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name, \"leadId\") VALUES ($1, $2, 'Budget project', $3), ($4, $5, 'Unbudgeted project', NULL)",
    [
      projectId,
      `B${suffix.slice(0, 5)}`,
      leadId,
      otherProjectId,
      `V${suffix.slice(0, 5)}`,
    ]
  );
  await authPool.query(
    'INSERT INTO project_member ("projectId", "userId") VALUES ($1, $2)',
    [projectId, memberId]
  );
  const created = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* create() {
        const work = yield* WorkManagement;
        return yield* work.createTask(memberId, {
          assigneeIds: [],
          description: null,
          dueDate: null,
          priority: "medium",
          projectId,
          title: "Budgeted work",
        });
      }),
      WorkManagementLive
    )
  );
  taskId = created.id;
});

afterAll(async () => {
  const notifications = await authPool.query<{ id: string }>(
    'SELECT id FROM notification WHERE "projectId" = $1',
    [projectId]
  );
  await authPool.query(
    "DELETE FROM job WHERE payload->>'notificationId' = ANY($1::text[])",
    [notifications.rows.map(({ id }) => id)]
  );
  await authPool.query('DELETE FROM notification WHERE "projectId" = $1', [
    projectId,
  ]);
  await authPool.query('DELETE FROM time_entry WHERE "taskId" = $1', [taskId]);
  await authPool.query(
    'DELETE FROM undo_record WHERE "actorId" = ANY($1::text[])',
    [createdUsers]
  );
  await authPool.query(
    'DELETE FROM activity WHERE "actorId" = ANY($1::text[])',
    [createdUsers]
  );
  await authPool.query('DELETE FROM task WHERE "projectId" = $1', [projectId]);
  await authPool.query("DELETE FROM project WHERE id = ANY($1::uuid[])", [
    [projectId, otherProjectId],
  ]);
  await authPool.query('DELETE FROM "user" WHERE id = $1', [clientId]);
  await authPool.query("DELETE FROM client_company WHERE id = $1", [companyId]);
  await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
    createdUsers.filter((id) => id !== clientId),
  ]);
});

it("reports burn for the current retainer month only", async () => {
  await budgets((service) =>
    service.save(adminId, projectId, retainer, OCTOBER)
  );
  await logMinutes(120, "2026-09-30");
  await logMinutes(240, "2026-10-01");
  await logMinutes(60, "2026-10-31");
  await logMinutes(30, "2026-11-01");

  const october = await budgets((service) =>
    service.get(adminId, projectId, OCTOBER)
  );
  expect(october).toMatchObject({
    level: "ok",
    percent: 50,
    period: { from: "2026-10-01", key: "2026-10", to: "2026-10-31" },
    remainingMinutes: 300,
    spentMinutes: 300,
  });

  const november = await budgets((service) =>
    service.get(adminId, projectId, NOVEMBER)
  );
  expect(november).toMatchObject({
    period: { key: "2026-11" },
    spentMinutes: 30,
  });
  await clearEntries();
});

it("counts all time for a one-off budget and can limit it to billable time", async () => {
  await budgets((service) =>
    service.save(adminId, projectId, { ...retainer, kind: "one_off" }, OCTOBER)
  );
  await logMinutes(120, "2026-01-05", true);
  await logMinutes(100, "2026-10-05", false);
  expect(
    await budgets((service) => service.get(adminId, projectId, OCTOBER))
  ).toMatchObject({ spentMinutes: 220 });

  await budgets((service) =>
    service.save(
      adminId,
      projectId,
      { ...retainer, billableOnly: true, kind: "one_off" },
      OCTOBER
    )
  );
  expect(
    await budgets((service) => service.get(adminId, projectId, OCTOBER))
  ).toMatchObject({ spentMinutes: 120 });
  await clearEntries();
});

it("shows the amount to administrators and hides rates from members", async () => {
  await budgets((service) =>
    service.save(adminId, projectId, retainer, OCTOBER)
  );
  await logMinutes(300, "2026-10-02");
  const adminView = await budgets((service) =>
    service.get(adminId, projectId, OCTOBER)
  );
  expect(adminView).toMatchObject({
    budgetAmountCents: 90_000,
    currency: "EUR",
    hourlyRateCents: 9000,
    spentAmountCents: 45_000,
  });
  const memberView = await budgets((service) =>
    service.get(memberId, projectId, OCTOBER)
  );
  expect(memberView).toMatchObject({ percent: 50, spentMinutes: 300 });
  expect(memberView).toMatchObject({
    budgetAmountCents: null,
    hourlyRateCents: null,
    spentAmountCents: null,
  });
  await clearEntries();
});

it("returns null for a project without a budget", async () => {
  expect(
    await budgets((service) => service.get(adminId, otherProjectId, OCTOBER))
  ).toBeNull();
});

it("lists budgets for administrators with spent, remaining and percent", async () => {
  await budgets((service) =>
    service.save(adminId, projectId, retainer, OCTOBER)
  );
  await logMinutes(660, "2026-10-02");
  const rows = await budgets((service) => service.list(adminId, OCTOBER));
  const row = rows.find((item) => item.projectId === projectId);
  expect(row).toMatchObject({
    level: "overrun",
    percent: 110,
    projectName: "Budget project",
    remainingMinutes: -60,
    spentMinutes: 660,
  });
  expect(rows.some((item) => item.projectId === otherProjectId)).toBe(false);
  await clearEntries();
});

it("refuses budgets to clients, outsiders and non-administrators who edit", async () => {
  expect(
    await failureCode((service) => service.get(clientId, projectId, OCTOBER))
  ).toBe("UNAUTHENTICATED");
  expect(await failureCode((service) => service.list(clientId, OCTOBER))).toBe(
    "UNAUTHENTICATED"
  );
  expect(
    await failureCode((service) => service.get(outsiderId, projectId, OCTOBER))
  ).toBe("FORBIDDEN");
  expect(await failureCode((service) => service.list(memberId, OCTOBER))).toBe(
    "FORBIDDEN"
  );
  expect(
    await failureCode((service) =>
      service.save(memberId, projectId, retainer, OCTOBER)
    )
  ).toBe("FORBIDDEN");
  expect(
    await failureCode((service) =>
      service.save(clientId, projectId, retainer, OCTOBER)
    )
  ).toBe("UNAUTHENTICATED");
  expect(await failureCode((service) => service.clear(leadId, projectId))).toBe(
    "FORBIDDEN"
  );
});

it("validates the budget and the project", async () => {
  const invalid = (changes: Partial<BudgetInput>) =>
    failureCode((service) =>
      service.save(adminId, projectId, { ...retainer, ...changes }, OCTOBER)
    );
  expect(await invalid({ budgetMinutes: 0 })).toBe("VALIDATION_FAILED");
  expect(await invalid({ budgetMinutes: 1.5 })).toBe("VALIDATION_FAILED");
  expect(await invalid({ warningPercent: 0 })).toBe("VALIDATION_FAILED");
  expect(await invalid({ warningPercent: 101 })).toBe("VALIDATION_FAILED");
  expect(await invalid({ hourlyRateCents: -1 })).toBe("VALIDATION_FAILED");
  expect(await invalid({ currency: "euro" })).toBe("VALIDATION_FAILED");
  expect(
    await failureCode((service) =>
      service.save(adminId, randomUUID(), retainer, OCTOBER)
    )
  ).toBe("NOT_FOUND");
});

it("announces the warning and the overrun exactly once per period", async () => {
  await budgets((service) =>
    service.save(adminId, projectId, retainer, OCTOBER)
  );
  await logMinutes(479, "2026-10-02");
  await evaluateBudgetAlerts(projectId, OCTOBER);
  expect(await notificationsFor(adminId)).toHaveLength(0);

  await logMinutes(1, "2026-10-03");
  await evaluateBudgetAlerts(projectId, OCTOBER);
  await evaluateBudgetAlerts(projectId, OCTOBER);
  const warnings = await notificationsFor(adminId);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]?.text).toContain("Budget project");
  expect(warnings[0]?.text.toLowerCase()).toContain("80%");
  expect(await notificationsFor(leadId)).toHaveLength(1);
  expect(await notificationsFor(memberId)).toHaveLength(0);
  expect(await notificationsFor(outsiderId)).toHaveLength(0);

  await logMinutes(100, "2026-10-04");
  await evaluateBudgetAlerts(projectId, OCTOBER);
  expect(await notificationsFor(adminId)).toHaveLength(1);

  await logMinutes(30, "2026-10-05");
  await evaluateBudgetAlerts(projectId, OCTOBER);
  await evaluateBudgetAlerts(projectId, OCTOBER);
  const afterOverrun = await notificationsFor(adminId);
  expect(afterOverrun).toHaveLength(2);
  expect(afterOverrun[1]?.text.toLowerCase()).toContain("over");
  expect(await notificationsFor(leadId)).toHaveLength(2);
});

it("announces again when a retainer renews and is crossed in the new month", async () => {
  const before = await notificationCount(adminId);
  await logMinutes(600, "2026-11-02");
  await evaluateBudgetAlerts(projectId, NOVEMBER);
  await evaluateBudgetAlerts(projectId, NOVEMBER);
  expect(await notificationsFor(adminId)).toHaveLength(before + 1);
  await clearEntries();
});

it("announces a straight jump past the budget once", async () => {
  const overruns = async () => {
    const rows = await notificationsFor(adminId);
    return rows.filter(({ text }) => text.toLowerCase().includes("over"))
      .length;
  };
  const before = await notificationCount(adminId);
  const overrunsBefore = await overruns();
  await logMinutes(700, "2026-10-02");
  await evaluateBudgetAlerts(projectId, OCTOBER);
  await evaluateBudgetAlerts(projectId, OCTOBER);
  expect(await notificationsFor(adminId)).toHaveLength(before + 1);
  expect(await overruns()).toBe(overrunsBefore + 1);
  await clearEntries();
});

it("raises the alert from a logged time entry", async () => {
  await budgets((service) =>
    service.save(
      adminId,
      projectId,
      { ...retainer, budgetMinutes: 60, kind: "one_off" },
      new Date()
    )
  );
  const before = await notificationCount(adminId);
  const today = new Date().toISOString().slice(0, 10);
  await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* log() {
        const time = yield* TimeTracking;
        return yield* time.addEntry(memberId, {
          billable: false,
          minutes: 61,
          note: null,
          taskId,
          workDate: today,
        });
      }),
      TimeTrackingLive
    )
  );
  expect(await notificationCount(adminId)).toBeGreaterThan(before);
});

it("stops tracking when the budget is cleared", async () => {
  await budgets((service) => service.clear(adminId, projectId));
  expect(
    await budgets((service) => service.get(adminId, projectId, OCTOBER))
  ).toBeNull();
  await evaluateBudgetAlerts(projectId, OCTOBER);
});
