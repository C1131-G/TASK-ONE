import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import { runEffectResult } from "../../src/server/core/action-result";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("applies bulk task changes atomically and enforces edit permission on every task", async () => {
  const suffix = randomUUID();
  const adminId = randomUUID();
  const employeeId = randomUUID();
  const projectId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false), ($4, $5, $6, $6, \'employee\', false)',
    [
      adminId,
      "Bulk Admin",
      `${adminId}@bulk-test.example`,
      employeeId,
      "Bulk Employee",
      `${employeeId}@bulk-test.example`,
    ]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `B${suffix.slice(0, 5)}`, "Bulk project"]
  );

  try {
    const createTasks = Effect.gen(function* createTasks() {
      const work = yield* WorkManagement;
      const employeeTask = yield* work.createTask(employeeId, {
        assigneeIds: [],
        description: null,
        dueDate: "2026-10-10",
        priority: "none",
        projectId,
        title: "Employee task",
      });
      const adminTask = yield* work.createTask(adminId, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "none",
        projectId,
        title: "Admin task",
      });
      return { adminTask, employeeTask };
    });
    const { adminTask, employeeTask } = await Effect.runPromise(
      Effect.provide(createTasks, WorkManagementLive)
    );
    const recurringVersion = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* setRecurrence() {
          const work = yield* WorkManagement;
          const result = yield* work.setTaskRecurrence(
            employeeId,
            employeeTask.id,
            employeeTask.version,
            {
              endsOn: null,
              frequency: "daily",
              interval: 1,
              weekDays: [],
            }
          );
          return result.version;
        }),
        WorkManagementLive
      )
    );
    const employeeBulk = Effect.gen(function* unauthorizedBulk() {
      const work = yield* WorkManagement;
      return yield* work.bulkUpdateTasks(
        employeeId,
        [
          { expectedVersion: recurringVersion, taskId: employeeTask.id },
          { expectedVersion: 1, taskId: adminTask.id },
        ],
        {
          assigneeIds: [],
          dueDate: "2026-10-10",
          priority: "high",
          status: "done",
        }
      );
    });
    const denied = await runEffectResult(
      Effect.provide(employeeBulk, WorkManagementLive)
    );
    expect(denied).toMatchObject({
      error: { code: "FORBIDDEN" },
      ok: false,
    });

    const employeeEdit = Effect.gen(function* employeeEdit() {
      const work = yield* WorkManagement;
      return yield* work.updateTask(
        employeeId,
        employeeTask.id,
        recurringVersion,
        {
          assigneeIds: [],
          description: null,
          dueDate: "2026-10-10",
          priority: "medium",
          status: "todo",
          title: "Still unchanged by failed bulk",
        }
      );
    });
    const unchangedTask = await Effect.runPromise(
      Effect.provide(employeeEdit, WorkManagementLive)
    );
    const adminBulk = Effect.gen(function* authorizedBulk() {
      const work = yield* WorkManagement;
      return yield* work.bulkUpdateTasks(
        adminId,
        [
          { expectedVersion: unchangedTask.version, taskId: employeeTask.id },
          { expectedVersion: adminTask.version, taskId: adminTask.id },
        ],
        {
          assigneeIds: [],
          dueDate: "2026-10-10",
          priority: "high",
          status: "done",
        }
      );
    });
    const updated = await Effect.runPromise(
      Effect.provide(adminBulk, WorkManagementLive)
    );
    expect(unchangedTask.version).toBe(3);
    expect(updated).toHaveLength(2);
    expect(updated.every((task) => task.status === "done")).toBe(true);
    expect(
      updated.find(({ id }) => id === employeeTask.id)?.completionUndo
    ).toBeDefined();
    expect(
      updated.find(({ id }) => id === employeeTask.id)?.recurrenceSuccessorId
    ).toBeDefined();
    expect(
      updated.find(({ id }) => id === adminTask.id)?.completionUndo
    ).toBeDefined();
  } finally {
    await authPool.query(
      "DELETE FROM job WHERE payload->>'userId' = ANY($1::text[])",
      [[adminId, employeeId]]
    );
    await authPool.query(
      'DELETE FROM notification WHERE "userId" = ANY($1::text[])',
      [[adminId, employeeId]]
    );
    await authPool.query(
      'DELETE FROM activity WHERE "actorId" = ANY($1::text[])',
      [[adminId, employeeId]]
    );
    await authPool.query('DELETE FROM undo_record WHERE "actorId" = $1', [
      adminId,
    ]);
    await authPool.query(
      'DELETE FROM recurrence_generation WHERE "sourceTaskId" IN (SELECT id FROM task WHERE "projectId" = $1) OR "successorTaskId" IN (SELECT id FROM task WHERE "projectId" = $1)',
      [projectId]
    );
    await authPool.query('DELETE FROM task WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
      [adminId, employeeId],
    ]);
  }
});

it("changes a task board column without resending its other fields", async () => {
  const actorId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  const email = `${actorId}@column-change-test.example`;
  const projectKey = `C${randomUUID().slice(0, 6)}`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Column Employee", email]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, projectKey, "Column project"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, description, priority, status, "createdById") VALUES ($1, $2, 1, $3, $4, $5, $6, $7)',
    [
      taskId,
      projectId,
      "Preserve this title",
      "Keep the description",
      "high",
      "todo",
      actorId,
    ]
  );

  try {
    const program = Effect.gen(function* program() {
      const work = yield* WorkManagement;
      return yield* work.changeTaskStatus(actorId, taskId, 1, "progress");
    });
    const updated = await Effect.runPromise(
      Effect.provide(program, WorkManagementLive)
    );
    expect(updated.status).toBe("progress");
    expect(updated.title).toBe("Preserve this title");
    expect(updated.description).toBe("Keep the description");
    expect(updated.priority).toBe("high");
    expect(updated.version).toBe(2);
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query("DELETE FROM task WHERE id = $1", [taskId]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});
