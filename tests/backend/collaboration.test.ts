import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  Collaboration,
  CollaborationLive,
} from "../../src/server/collaboration/service";
import { runEffectResult } from "../../src/server/core/action-result";
import { JobHandlersLive } from "../../src/server/jobs/handlers";
import {
  JobProcessor,
  JobProcessorLive,
} from "../../src/server/jobs/processor";
import { PushTransport } from "../../src/server/notifications/push-transport";
import {
  Notifications,
  NotificationsLive,
} from "../../src/server/notifications/service";
import { Storage } from "../../src/server/storage/storage";

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
      return { comment, comments };
    });
    const result = await Effect.runPromise(
      Effect.provide(program, CollaborationLive)
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

it("queues and delivers a push job when a comment mentions an employee", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const recipientId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  const emailActor = `${actorId}@comment-push-test.example`;
  const emailRecipient = `${recipientId}@comment-push-test.example`;
  const deliveredNotifications: string[] = [];
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false), ($4, $5, $6, $6, \'employee\', false)',
    [
      actorId,
      "Comment Author",
      emailActor,
      recipientId,
      "Mention Recipient",
      emailRecipient,
    ]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `M${suffix.slice(0, 6)}`, "Comment push project"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, 1, $3, $4)',
    [taskId, projectId, "Mention task", actorId]
  );
  await authPool.query(
    'INSERT INTO task_assignee ("taskId", "userId", "assignedById") VALUES ($1, $2, $3)',
    [taskId, recipientId, actorId]
  );
  await authPool.query(
    'INSERT INTO push_subscription (id, "userId", endpoint, keys) VALUES ($1, $2, $3, $4::jsonb)',
    [
      randomUUID(),
      recipientId,
      `https://fcm.googleapis.com/${recipientId}`,
      JSON.stringify({
        auth: "auth-key-123456",
        p256dh: "public-key-1234567890",
      }),
    ]
  );
  const pushLayer = Layer.succeed(
    PushTransport,
    PushTransport.of({
      send: (_subscription, message) => {
        deliveredNotifications.push(message.notificationId);
        return Effect.succeed("delivered");
      },
    })
  );
  const storageLayer = Layer.succeed(
    Storage,
    Storage.of({
      copyObject: () => Effect.void,
      deleteObject: () => Effect.void,
      signDownload: () => Effect.succeed("https://private.example/download"),
      signPreview: () => Effect.succeed("https://private.example/preview"),
      signUpload: () => Effect.succeed("https://private.example/upload"),
      verifyObject: () => Effect.void,
    })
  );
  const workerLayer = Layer.provide(
    JobProcessorLive,
    Layer.provide(JobHandlersLive, Layer.merge(pushLayer, storageLayer))
  );

  try {
    const createProgram = Effect.gen(function* program() {
      const collaboration = yield* Collaboration;
      return yield* collaboration.createComment(
        actorId,
        taskId,
        `@[${recipientId}] please review this draft`
      );
    });
    const comment = await Effect.runPromise(
      Effect.provide(createProgram, CollaborationLive)
    );
    const plainComment = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* program() {
          const collaboration = yield* Collaboration;
          return yield* collaboration.createComment(
            actorId,
            taskId,
            "The latest draft is ready for your review."
          );
        }),
        CollaborationLive
      )
    );
    const inboxProgram = Effect.gen(function* program() {
      const notifications = yield* Notifications;
      return yield* notifications.listInbox(recipientId, {
        limit: 10,
        unreadOnly: true,
      });
    });
    const inbox = await Effect.runPromise(
      Effect.provide(inboxProgram, NotificationsLive)
    );
    const workerProgram = Effect.gen(function* program() {
      const processor = yield* JobProcessor;
      return yield* processor.processBatch(`comment-push-${taskId}`, 10);
    });
    const workerResult = await Effect.runPromise(
      Effect.provide(workerProgram, workerLayer)
    );

    expect(comment.taskId).toBe(taskId);
    expect(plainComment.taskId).toBe(taskId);
    expect(inbox.items).toHaveLength(2);
    expect(inbox.items.map(({ type }) => type).toSorted()).toEqual([
      "comment",
      "mention",
    ]);
    expect(workerResult.completed).toBeGreaterThanOrEqual(1);
    const notificationId = inbox.items[0]?.id;
    if (!notificationId) {
      throw new Error("The mention should create an inbox notification.");
    }
    expect(deliveredNotifications).toContain(notificationId);
    expect(deliveredNotifications).toHaveLength(2);
  } finally {
    await authPool.query("DELETE FROM job WHERE payload ->> 'userId' = $1", [
      recipientId,
    ]);
    await authPool.query('DELETE FROM push_subscription WHERE "userId" = $1', [
      recipientId,
    ]);
    await authPool.query('DELETE FROM push_delivery WHERE "userId" = $1', [
      recipientId,
    ]);
    await authPool.query('DELETE FROM notification WHERE "userId" = $1', [
      recipientId,
    ]);
    await authPool.query('DELETE FROM task_assignee WHERE "userId" = $1', [
      recipientId,
    ]);
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query('DELETE FROM comment WHERE "taskId" = $1', [taskId]);
    await authPool.query("DELETE FROM task WHERE id = $1", [taskId]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
      [actorId, recipientId],
    ]);
  }
});
