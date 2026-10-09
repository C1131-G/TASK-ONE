import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { Dashboard, DashboardLive } from "../../src/server/dashboard/service";

it("summarizes active projects, task statuses, overdue work, and employee workload", async () => {
  const suffix = randomUUID();
  const employeeId = randomUUID();
  const projectId = randomUUID();
  const todoTaskId = randomUUID();
  const doneTaskId = randomUUID();
  const email = `${employeeId}@dashboard-test.example`;
  const projectKey = `D${suffix.slice(0, 6)}`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [employeeId, "Dashboard Employee", email, "employee"]
  );
  const baselineProgram = Effect.gen(function* program() {
    const dashboard = yield* Dashboard;
    return yield* dashboard.getOverview(employeeId);
  });
  const baseline = await Effect.runPromise(
    Effect.provide(baselineProgram, DashboardLive)
  );
  await authPool.query(
    "INSERT INTO project (id, key, name, status) VALUES ($1, $2, $3, $4)",
    [projectId, projectKey, "Dashboard Project", "active"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, status, "dueDate", "createdById") VALUES ($1, $2, 1, $3, $4, current_date - 1, $5), ($6, $2, 2, $7, $8, NULL, $5)',
    [
      todoTaskId,
      projectId,
      "Overdue task",
      "todo",
      employeeId,
      doneTaskId,
      "Completed task",
      "done",
    ]
  );
  await authPool.query(
    'INSERT INTO task_assignee ("taskId", "userId", "assignedById") VALUES ($1, $2, $2), ($3, $2, $2)',
    [todoTaskId, employeeId, doneTaskId]
  );

  try {
    const program = Effect.gen(function* program() {
      const dashboard = yield* Dashboard;
      return yield* dashboard.getOverview(employeeId);
    });
    const overview = await Effect.runPromise(
      Effect.provide(program, DashboardLive)
    );

    expect(overview.projects.active).toBe(baseline.projects.active + 1);
    expect(overview.tasks.todo).toBe(baseline.tasks.todo + 1);
    expect(overview.tasks.done).toBe(baseline.tasks.done + 1);
    expect(overview.overdueCount).toBe(baseline.overdueCount + 1);
    expect(overview.workload).toContainEqual({
      employeeId,
      employeeName: "Dashboard Employee",
      openTaskCount: 1,
    });
  } finally {
    await authPool.query('DELETE FROM task_assignee WHERE "userId" = $1', [
      employeeId,
    ]);
    await authPool.query("DELETE FROM task WHERE id = ANY($1::uuid[])", [
      [todoTaskId, doneTaskId],
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [employeeId]);
  }
});
