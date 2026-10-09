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

it("moves a task into an active project with a fresh destination number", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const sourceProjectId = randomUUID();
  const destinationProjectId = randomUUID();
  const email = `${actorId}@move-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Task Mover", email]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3), ($4, $5, $6)",
    [
      sourceProjectId,
      `M${suffix.slice(0, 5)}`,
      "Move source",
      destinationProjectId,
      `N${suffix.slice(0, 5)}`,
      "Move destination",
    ]
  );

  try {
    const create = Effect.gen(function* createTask() {
      const work = yield* WorkManagement;
      return yield* work.createTask(actorId, {
        assigneeIds: [],
        description: "Keep attached file references",
        dueDate: null,
        priority: "medium",
        projectId: sourceProjectId,
        title: "Move this task",
      });
    });
    const sourceTask = await Effect.runPromise(
      Effect.provide(create, WorkManagementLive)
    );
    const move = Effect.gen(function* moveTask() {
      const work = yield* WorkManagement;
      return yield* work.moveTask(
        actorId,
        sourceTask.id,
        destinationProjectId,
        sourceTask.version
      );
    });
    const movedTask = await Effect.runPromise(
      Effect.provide(move, WorkManagementLive)
    );

    expect(movedTask.id).toBe(sourceTask.id);
    expect(movedTask.projectId).toBe(destinationProjectId);
    expect(movedTask.projectTaskNumber).toBe(1);
    expect(movedTask.version).toBe(2);
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query(
      'DELETE FROM task WHERE id IN (SELECT id FROM task WHERE "projectId" = ANY($1::uuid[]))',
      [[sourceProjectId, destinationProjectId]]
    );
    await authPool.query("DELETE FROM project WHERE id = ANY($1::uuid[])", [
      [sourceProjectId, destinationProjectId],
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});

it("blocks task moves while a signed upload is still pending", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const sourceProjectId = randomUUID();
  const destinationProjectId = randomUUID();
  const uploadIntentId = randomUUID();
  const email = `${actorId}@pending-move-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Pending Upload Owner", email]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3), ($4, $5, $6)",
    [
      sourceProjectId,
      `Q${suffix.slice(0, 5)}`,
      "Pending source",
      destinationProjectId,
      `R${suffix.slice(0, 5)}`,
      "Pending destination",
    ]
  );

  try {
    const create = Effect.gen(function* createTask() {
      const work = yield* WorkManagement;
      return yield* work.createTask(actorId, {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "none",
        projectId: sourceProjectId,
        title: "Task with pending upload",
      });
    });
    const task = await Effect.runPromise(
      Effect.provide(create, WorkManagementLive)
    );
    await authPool.query(
      `INSERT INTO upload_intent
         (id, "ownerId", "taskId", "projectId", "objectKey", "fileName",
          "contentType", "sizeBytes", state, "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 128, 'pending', now() + interval '10 minutes')`,
      [
        uploadIntentId,
        actorId,
        task.id,
        sourceProjectId,
        `pending/${uploadIntentId}`,
        "pending.pdf",
        "application/pdf",
      ]
    );
    const blockedMove = Effect.gen(function* moveWithPendingUpload() {
      const work = yield* WorkManagement;
      return yield* work.moveTask(
        actorId,
        task.id,
        destinationProjectId,
        task.version
      );
    });
    const blocked = await runEffectResult(
      Effect.provide(blockedMove, WorkManagementLive)
    );
    expect(blocked).toMatchObject({
      error: { code: "CONFLICT" },
      ok: false,
    });

    await authPool.query("DELETE FROM upload_intent WHERE id = $1", [
      uploadIntentId,
    ]);
    const retryMove = Effect.gen(function* retryMove() {
      const work = yield* WorkManagement;
      return yield* work.moveTask(
        actorId,
        task.id,
        destinationProjectId,
        task.version
      );
    });
    const moved = await Effect.runPromise(
      Effect.provide(retryMove, WorkManagementLive)
    );
    expect(moved.projectId).toBe(destinationProjectId);
    expect(moved.version).toBe(2);
  } finally {
    await authPool.query("DELETE FROM upload_intent WHERE id = $1", [
      uploadIntentId,
    ]);
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query(
      'DELETE FROM task WHERE "projectId" = ANY($1::uuid[])',
      [[sourceProjectId, destinationProjectId]]
    );
    await authPool.query("DELETE FROM project WHERE id = ANY($1::uuid[])", [
      [sourceProjectId, destinationProjectId],
    ]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});
