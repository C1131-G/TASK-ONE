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

it("duplicates active task structure without carrying comments or completion", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  const email = `${actorId}@duplicate-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Task Duplicator", email]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `D${suffix.slice(0, 5)}`, "Duplicate project"]
  );

  try {
    const create = Effect.gen(function* createTask() {
      const work = yield* WorkManagement;
      return yield* work.createTask(actorId, {
        assigneeIds: [actorId],
        description: "Copy this task",
        dueDate: "2026-11-20",
        priority: "high",
        projectId,
        title: "Prepare launch",
      });
    });
    const source = await Effect.runPromise(
      Effect.provide(create, WorkManagementLive)
    );
    await authPool.query(
      `INSERT INTO task_subtask (id, "taskId", title, "isCompleted", position)
       VALUES ($1, $2, 'Confirm copy', true, 0)`,
      [randomUUID(), source.id]
    );
    await authPool.query(
      `UPDATE task SET status = 'done', "completedAt" = now(), version = 2 WHERE id = $1`,
      [source.id]
    );
    const duplicate = Effect.gen(function* duplicateTask() {
      const work = yield* WorkManagement;
      return yield* work.duplicateTask(actorId, source.id, 2);
    });
    const copied = await Effect.runPromise(
      Effect.provide(duplicate, WorkManagementLive)
    );

    expect(copied.id).not.toBe(source.id);
    expect(copied.projectTaskNumber).toBe(2);
    expect(copied.status).toBe("todo");
    expect(copied.title).toBe("Prepare launch (copy)");
    expect(copied.assigneeIds).toEqual([actorId]);
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query('DELETE FROM task WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});

it("archives a task and allows only its actor to undo within the window", async () => {
  const suffix = randomUUID();
  const adminId = randomUUID();
  const projectId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false)',
    [adminId, "Archive Admin", `${adminId}@archive-test.example`]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `A${suffix.slice(0, 5)}`, "Archive project"]
  );

  try {
    const create = Effect.gen(function* createTask() {
      const work = yield* WorkManagement;
      return yield* work.createTask(adminId, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "none",
        projectId,
        title: "Archive me",
      });
    });
    const task = await Effect.runPromise(
      Effect.provide(create, WorkManagementLive)
    );
    const archive = Effect.gen(function* archiveTask() {
      const work = yield* WorkManagement;
      return yield* work.archiveTask(adminId, task.id, task.version);
    });
    const receipt = await Effect.runPromise(
      Effect.provide(archive, WorkManagementLive)
    );
    const activeTasks = Effect.gen(function* listActiveTasks() {
      const work = yield* WorkManagement;
      return yield* work.listProjectTasks(adminId, projectId, {
        limit: 20,
        offset: 0,
      });
    });
    const archivedTasks = Effect.gen(function* listArchivedTasks() {
      const work = yield* WorkManagement;
      return yield* work.listProjectTasks(adminId, projectId, {
        includeArchived: true,
        limit: 20,
        offset: 0,
      });
    });
    expect(
      await Effect.runPromise(Effect.provide(activeTasks, WorkManagementLive))
    ).toHaveLength(0);
    expect(
      await Effect.runPromise(Effect.provide(archivedTasks, WorkManagementLive))
    ).toMatchObject([{ archivedAt: expect.any(String), id: task.id }]);
    const archivedEdit = Effect.gen(function* editArchived() {
      const work = yield* WorkManagement;
      return yield* work.updateTask(adminId, task.id, 2, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "none",
        status: "todo",
        title: "No edits while archived",
      });
    });
    const denied = await runEffectResult(
      Effect.provide(archivedEdit, WorkManagementLive)
    );
    expect(denied).toMatchObject({
      error: { code: "FORBIDDEN" },
      ok: false,
    });

    const undo = Effect.gen(function* undoArchive() {
      const work = yield* WorkManagement;
      return yield* work.undoTaskArchive(adminId, receipt.undoId);
    });
    await Effect.runPromise(Effect.provide(undo, WorkManagementLive));
    const update = Effect.gen(function* updateAfterUndo() {
      const work = yield* WorkManagement;
      return yield* work.updateTask(adminId, task.id, 3, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "none",
        status: "todo",
        title: "Restored and editable",
      });
    });
    const restoredUpdate = await Effect.runPromise(
      Effect.provide(update, WorkManagementLive)
    );
    const reusedUndo = await runEffectResult(
      Effect.provide(undo, WorkManagementLive)
    );

    expect(receipt.undoId).toBeTruthy();
    expect(restoredUpdate.title).toBe("Restored and editable");
    expect(reusedUndo).toMatchObject({
      error: { code: "CONFLICT" },
      ok: false,
    });
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      adminId,
    ]);
    await authPool.query('DELETE FROM undo_record WHERE "actorId" = $1', [
      adminId,
    ]);
    await authPool.query('DELETE FROM task WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [adminId]);
  }
});
