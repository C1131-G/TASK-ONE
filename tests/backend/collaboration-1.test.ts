import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import {
  ActivityManagement,
  ActivityManagementLive,
} from "../../src/server/activity/activity-management";
import { authPool } from "../../src/server/auth/database";
import {
  Collaboration,
  CollaborationLive,
} from "../../src/server/collaboration/service";
import { runEffectResult } from "../../src/server/core/action-result";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("creates a plain-text comment on a visible active task", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  const email = `${actorId}@comment-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [actorId, "Comment Author", email, "employee"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `C${suffix.slice(0, 6)}`, "Comment test project"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, 1, $3, $4)',
    [taskId, projectId, "Comment test task", actorId]
  );

  try {
    const program = Effect.gen(function* program() {
      const collaboration = yield* Collaboration;
      const comment = yield* collaboration.createComment(
        actorId,
        taskId,
        "Plain text <script>alert(1)</script>"
      );
      yield* collaboration.toggleReaction(actorId, comment.id, "👍");
      const comments = yield* collaboration.listComments(actorId, taskId);
      const activity = yield* ActivityManagement;
      const feed = yield* activity.list(actorId, { taskId }, 10);
      return { activity: feed, comment, comments };
    });
    const result = await Effect.runPromise(
      Effect.provide(
        program,
        Layer.mergeAll(CollaborationLive, ActivityManagementLive)
      )
    );

    expect(result.comment.taskId).toBe(taskId);
    expect(result.comment.body).toBe("Plain text <script>alert(1)</script>");
    expect(result.comment.authorId).toBe(actorId);
    expect(result.comments).toMatchObject([
      {
        authorId: actorId,
        authorName: "Comment Author",
        body: "Plain text <script>alert(1)</script>",
        id: result.comment.id,
        reactions: [{ count: 1, emoji: "👍", reacted: true }],
        taskId,
      },
    ]);
    expect(result.activity).toContainEqual(
      expect.objectContaining({
        action: "comment.created",
        actorId,
        actorName: "Comment Author",
        taskId,
      })
    );
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query('DELETE FROM comment WHERE "taskId" = $1', [taskId]);
    await authPool.query("DELETE FROM task WHERE id = $1", [taskId]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});

it("allows only the removing actor to undo comment removal once within five minutes", async () => {
  const actorId = randomUUID();
  const otherId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false), ($5, $6, $7, $7, $8, false)',
    [
      actorId,
      "Undo Author",
      `${actorId}@comment-undo.example`,
      "employee",
      otherId,
      "Undo Other",
      `${otherId}@comment-undo.example`,
      "employee",
    ]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `U${projectId.slice(0, 6)}`, "Comment undo"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, 1, $3, $4)',
    [taskId, projectId, "Comment undo task", actorId]
  );

  try {
    const createProgram = Effect.gen(function* create() {
      const collaboration = yield* Collaboration;
      return yield* collaboration.createComment(
        actorId,
        taskId,
        "Keep this comment"
      );
    });
    const comment = await Effect.runPromise(
      Effect.provide(createProgram, CollaborationLive)
    );
    const removeProgram = Effect.gen(function* remove() {
      const collaboration = yield* Collaboration;
      return yield* collaboration.removeComment(actorId, comment.id);
    });
    const receipt = await Effect.runPromise(
      Effect.provide(removeProgram, CollaborationLive)
    );
    const crossActorUndo = Effect.gen(function* undoAsOther() {
      const collaboration = yield* Collaboration;
      yield* collaboration.undoCommentRemoval(otherId, receipt.undoId);
    });
    const denied = await runEffectResult(
      Effect.provide(crossActorUndo, CollaborationLive)
    );
    const undoProgram = Effect.gen(function* undo() {
      const collaboration = yield* Collaboration;
      yield* collaboration.undoCommentRemoval(actorId, receipt.undoId);
      yield* collaboration.undoCommentRemoval(actorId, receipt.undoId);
    });
    const reused = await runEffectResult(
      Effect.provide(undoProgram, CollaborationLive)
    );

    expect(receipt.expiresAt).toBeTruthy();
    expect(denied).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
    expect(reused).toMatchObject({ error: { code: "CONFLICT" }, ok: false });
  } finally {
    await authPool.query(
      'DELETE FROM undo_record WHERE "actorId" = ANY($1::text[])',
      [[actorId, otherId]]
    );
    await authPool.query(
      'DELETE FROM activity WHERE "actorId" = ANY($1::text[])',
      [[actorId, otherId]]
    );
    await authPool.query('DELETE FROM comment WHERE "taskId" = $1', [taskId]);
    await authPool.query("DELETE FROM task WHERE id = $1", [taskId]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
      [actorId, otherId],
    ]);
  }
});
