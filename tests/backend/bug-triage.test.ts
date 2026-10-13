import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  BugManagement,
  BugManagementLive,
} from "../../src/server/work/bug-management";
import {
  BugWorkflowManagement,
  BugWorkflowManagementLive,
} from "../../src/server/work/bug-workflow-management";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("lets an admin triage a bug, set severity and priority, and assign an employee", async () => {
  const adminId = randomUUID();
  const employeeId = randomUUID();
  const projectId = randomUUID();
  const suffix = randomUUID();
  const projectKey = `T${suffix.slice(0, 7)}`;
  const adminEmail = `${adminId}@bug-triage.example`;
  const employeeEmail = `${employeeId}@bug-triage.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false), ($5, $6, $7, $7, $8, false)',
    [
      adminId,
      "Bug Admin",
      adminEmail,
      "admin",
      employeeId,
      "Bug Employee",
      employeeEmail,
      "employee",
    ]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, projectKey, "Bug triage test"]
  );

  try {
    const result = await Effect.runPromise(
      Effect.gen(function* triageAndQuery() {
        const bugs = yield* BugManagement;
        const workflow = yield* BugWorkflowManagement;
        const report = yield* bugs.reportBug(employeeId, {
          actualBehavior: "The dashboard shows a blank panel.",
          appVersion: "2.4.1",
          browser: "Firefox",
          component: "DashboardSummary",
          description: null,
          device: "Desktop",
          discoverySource: "employee_report",
          environment: "staging",
          expectedBehavior: "The dashboard should show project totals.",
          os: "Windows",
          projectId,
          reproductionSteps: ["Open dashboard", "Wait for data"],
          route: "/overview",
          severity: "minor",
          title: "Dashboard summary is blank",
        });
        const triage = yield* workflow.triage(adminId, {
          assigneeIds: [employeeId],
          bugId: report.id,
          expectedVersion: report.version,
          priority: "high",
          severity: "critical",
        });
        const listed = yield* bugs.listBugs(employeeId, { projectId });
        return { listed, triage };
      }).pipe(
        Effect.provide(BugManagementLive),
        Effect.provide(BugWorkflowManagementLive)
      )
    );

    expect(result.triage.status).toBe("triaged");
    expect(result.listed[0]).toMatchObject({
      assigneeIds: [employeeId],
      bug: { severity: "critical", status: "triaged" },
      priority: "high",
    });
  } finally {
    await authPool.query(
      'DELETE FROM job WHERE "dedupeKey" IN (SELECT \'push:\' || id::text FROM notification WHERE "taskId" IN (SELECT id FROM task WHERE "projectId" = $1))',
      [projectId]
    );
    await authPool.query(
      'DELETE FROM notification WHERE "taskId" IN (SELECT id FROM task WHERE "projectId" = $1)',
      [projectId]
    );
    await authPool.query('DELETE FROM activity WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query('DELETE FROM "bug_report" WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query(
      'DELETE FROM "task_assignee" WHERE "taskId" IN (SELECT id FROM task WHERE "projectId" = $1)',
      [projectId]
    );
    await authPool.query('DELETE FROM task WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id IN ($1, $2)', [
      adminId,
      employeeId,
    ]);
  }
});
