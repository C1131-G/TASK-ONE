import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  Collaboration,
  CollaborationLive,
} from "../../src/server/collaboration/service";
import { runEffectResult } from "../../src/server/core/action-result";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("lets exactly one of two competing comment-removal undos succeed", async () => {
  const actorId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [actorId, "Competing Undo", `${actorId}@competing-undo.example`, "employee"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `R${projectId.slice(0, 6)}`.toUpperCase(), "Competing undo"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, 1, $3, $4)',
    [taskId, projectId, "Competing undo task", actorId]
  );

  try {
    const comment = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* createComment() {
          const collaboration = yield* Collaboration;
          return yield* collaboration.createComment(
            actorId,
            taskId,
            "Competing undo comment"
          );
        }),
        CollaborationLive
      )
    );
    const receipt = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* removeComment() {
          const collaboration = yield* Collaboration;
          return yield* collaboration.removeComment(actorId, comment.id);
        }),
        CollaborationLive
      )
    );

    const undo = () =>
      runEffectResult(
        Effect.provide(
          Effect.gen(function* undoRemoval() {
            const collaboration = yield* Collaboration;
            yield* collaboration.undoCommentRemoval(actorId, receipt.undoId);
          }),
          CollaborationLive
        )
      );
    const outcomes = await Promise.all([undo(), undo(), undo()]);

    const succeeded = outcomes.filter((outcome) => outcome.ok);
    const rejected = outcomes.filter((outcome) => !outcome.ok);
    expect(succeeded).toHaveLength(1);
    for (const outcome of rejected) {
      expect(outcome).toMatchObject({ error: { code: "CONFLICT" }, ok: false });
    }
    const restored = await authPool.query(
      'SELECT "deletedAt" FROM comment WHERE id = $1',
      [comment.id]
    );
    expect(restored.rows[0]?.deletedAt).toBeNull();
  } finally {
    await authPool.query('DELETE FROM undo_record WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query('DELETE FROM comment WHERE "taskId" = $1', [taskId]);
    await authPool.query('DELETE FROM task WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});
