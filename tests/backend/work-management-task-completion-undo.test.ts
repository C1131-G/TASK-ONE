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

it("allows the completing actor to undo completion once without overwriting later edits", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Completion Owner", `${actorId}@completion-undo.example`]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `U${suffix.slice(0, 5)}`, "Completion undo project"]
  );

  try {
    const task = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* createTask() {
          const work = yield* WorkManagement;
          return yield* work.createTask(actorId, {
            assigneeIds: [],
            description: null,
            dueDate: null,
            priority: "none",
            projectId,
            title: "Complete this task",
          });
        }),
        WorkManagementLive
      )
    );
    const completed = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* completeTask() {
          const work = yield* WorkManagement;
          return yield* work.updateTask(actorId, task.id, task.version, {
            assigneeIds: [],
            description: null,
            dueDate: null,
            priority: "none",
            status: "done",
            title: task.title,
          });
        }),
        WorkManagementLive
      )
    );

    expect(completed.completionUndo).toBeDefined();
    if (!completed.completionUndo) {
      throw new Error("Completing a task should return its undo receipt.");
    }
    const { completionUndo } = completed;
    const undo = Effect.gen(function* undoCompletion() {
      const work = yield* WorkManagement;
      return yield* work.undoTaskCompletion(actorId, completionUndo.undoId);
    });
    await Effect.runPromise(Effect.provide(undo, WorkManagementLive));
    const reopened = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* verifyReopenedTask() {
          const work = yield* WorkManagement;
          return yield* work.updateTask(
            actorId,
            task.id,
            completed.version + 1,
            {
              assigneeIds: [],
              description: null,
              dueDate: null,
              priority: "none",
              status: "progress",
              title: task.title,
            }
          );
        }),
        WorkManagementLive
      )
    );
    const reusedReceipt = await runEffectResult(
      Effect.provide(undo, WorkManagementLive)
    );

    expect(reopened.status).toBe("progress");
    expect(reusedReceipt).toMatchObject({
      error: { code: "CONFLICT" },
      ok: false,
    });
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query('DELETE FROM undo_record WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query(
      'DELETE FROM recurrence_generation WHERE "sourceTaskId" IN (SELECT id FROM task WHERE "projectId" = $1) OR "successorTaskId" IN (SELECT id FROM task WHERE "projectId" = $1)',
      [projectId]
    );
    await authPool.query('DELETE FROM task WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});
