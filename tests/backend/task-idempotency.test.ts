import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  Idempotency,
  IdempotencyLive,
} from "../../src/server/core/idempotency";
import {
  CreatedTaskSchema,
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("replays a task update without bumping the task version a second time", async () => {
  const actorId = randomUUID();
  const projectId = randomUUID();
  const suffix = projectId.replaceAll("-", "").slice(0, 6).toUpperCase();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Task Idempotency", `${actorId}@task-idem.example`]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `T${suffix}`, "Task idempotency"]
  );

  try {
    const result = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* updateTaskTwice() {
          const idempotency = yield* Idempotency;
          const work = yield* WorkManagement;
          const created = yield* work.createTask(actorId, {
            assigneeIds: [],
            description: null,
            dueDate: null,
            priority: "medium",
            projectId,
            title: "Original title",
          });
          const update = {
            assigneeIds: [],
            description: null,
            dueDate: null,
            priority: "high" as const,
            status: "todo" as const,
            title: "Updated once",
          };
          const updateOnce = () =>
            idempotency.run({
              actorId,
              execute: () =>
                work.updateTask(actorId, created.id, created.version, update),
              input: {
                ...update,
                expectedVersion: created.version,
                taskId: created.id,
              },
              key: "task-update-0001",
              operation: "task.update",
              resultSchema: CreatedTaskSchema,
            });
          const first = yield* updateOnce();
          const replayed = yield* updateOnce();
          return { created, first, replayed };
        }),
        Layer.mergeAll(IdempotencyLive, WorkManagementLive)
      )
    );

    expect(result.replayed.version).toBe(result.first.version);
    expect(result.first.version).toBe(result.created.version + 1);
    const rows = await authPool.query(
      "SELECT version, title FROM task WHERE id = $1",
      [result.created.id]
    );
    expect(rows.rows[0]).toMatchObject({
      title: "Updated once",
      version: result.first.version,
    });
  } finally {
    await authPool.query('DELETE FROM idempotency_key WHERE "actorId" = $1', [
      actorId,
    ]);
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
