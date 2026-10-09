import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  Collaboration,
  CollaborationLive,
  CommentReactionResultSchema,
  CreatedCommentSchema,
  UndoReceiptSchema,
} from "../../src/server/collaboration/service";
import {
  Idempotency,
  IdempotencyLive,
} from "../../src/server/core/idempotency";
import {
  CreatedSubtaskSchema,
  SubtaskManagement,
  SubtaskManagementLive,
} from "../../src/server/tasks/subtask-management";
import {
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

const seedFixture = async (actorId: string, projectId: string) => {
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [
      actorId,
      "Comment Subtask Owner",
      `${actorId}@comment-subtask-idem.example`,
    ]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [
      projectId,
      `M${projectId.replaceAll("-", "").slice(0, 6)}`.toUpperCase(),
      "Idempotent comments",
    ]
  );
};

const createTask = (actorId: string, projectId: string) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* createTaskFixture() {
        const work = yield* WorkManagement;
        return yield* work.createTask(actorId, {
          assigneeIds: [],
          description: null,
          dueDate: null,
          priority: "medium",
          projectId,
          title: "Idempotent task",
        });
      }),
      WorkManagementLive
    )
  );

const cleanup = async (actorId: string, projectId: string) => {
  await authPool.query('DELETE FROM "idempotency_key" WHERE "actorId" = $1', [
    actorId,
  ]);
  await authPool.query('DELETE FROM undo_record WHERE "actorId" = $1', [
    actorId,
  ]);
  await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [actorId]);
  await authPool.query(
    'DELETE FROM comment WHERE "taskId" IN (SELECT id FROM task WHERE "projectId" = $1)',
    [projectId]
  );
  await authPool.query('DELETE FROM task WHERE "projectId" = $1', [projectId]);
  await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
  await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
};

const layers = Layer.mergeAll(
  IdempotencyLive,
  CollaborationLive,
  SubtaskManagementLive,
  WorkManagementLive
);

it("replays a comment create and a reaction toggle without repeating their effect", async () => {
  const actorId = randomUUID();
  const projectId = randomUUID();
  await seedFixture(actorId, projectId);

  try {
    const task = await createTask(actorId, projectId);
    const result = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* commentIdempotency() {
          const collaboration = yield* Collaboration;
          const idempotency = yield* Idempotency;
          const body = "Replay this comment once";
          const createOnce = () =>
            idempotency.run({
              actorId,
              execute: () =>
                collaboration.createComment(actorId, task.id, body),
              input: { body, taskId: task.id },
              key: "comment-create-0001",
              operation: "comment.create",
              resultSchema: CreatedCommentSchema,
            });
          const created = yield* createOnce();
          const replayed = yield* createOnce();
          const changed = yield* Effect.result(
            idempotency.run({
              actorId,
              execute: () =>
                collaboration.createComment(actorId, task.id, "Different body"),
              input: { body: "Different body", taskId: task.id },
              key: "comment-create-0001",
              operation: "comment.create",
              resultSchema: CreatedCommentSchema,
            })
          );

          const toggle = (key: string) =>
            idempotency.run({
              actorId,
              execute: () =>
                collaboration.toggleReaction(actorId, created.id, "👍"),
              input: { commentId: created.id, emoji: "👍" },
              key,
              operation: "comment.toggleReaction",
              resultSchema: CommentReactionResultSchema,
            });
          const firstToggle = yield* toggle("reaction-toggle-0001");
          const retriedToggle = yield* toggle("reaction-toggle-0001");
          const nextToggle = yield* toggle("reaction-toggle-0002");

          return {
            changed,
            created,
            firstToggle,
            nextToggle,
            replayed,
            retriedToggle,
          };
        }),
        layers
      )
    );

    expect(result.replayed.id).toBe(result.created.id);
    expect(result.changed._tag).toBe("Failure");
    expect(result.retriedToggle).toEqual(result.firstToggle);
    expect(result.nextToggle.active).toBe(!result.firstToggle.active);

    const comments = await authPool.query(
      'SELECT id FROM comment WHERE "taskId" = $1',
      [task.id]
    );
    expect(comments.rows).toHaveLength(1);
  } finally {
    await cleanup(actorId, projectId);
  }
});

it("replays a subtask create without adding a second subtask or bumping the parent twice", async () => {
  const actorId = randomUUID();
  const projectId = randomUUID();
  await seedFixture(actorId, projectId);

  try {
    const task = await createTask(actorId, projectId);
    const fields = {
      assigneeId: null,
      description: null,
      dueDate: null,
      title: "Replayed subtask",
    };
    const result = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* subtaskIdempotency() {
          const subtasks = yield* SubtaskManagement;
          const idempotency = yield* Idempotency;
          const createOnce = () =>
            idempotency.run({
              actorId,
              execute: () =>
                subtasks.createSubtask(actorId, task.id, task.version, fields),
              input: {
                ...fields,
                expectedTaskVersion: task.version,
                taskId: task.id,
              },
              key: "subtask-create-0001",
              operation: "subtask.create",
              resultSchema: CreatedSubtaskSchema,
            });
          const created = yield* createOnce();
          const replayed = yield* createOnce();
          return { created, replayed };
        }),
        layers
      )
    );

    expect(result.replayed.subtask.id).toBe(result.created.subtask.id);
    expect(result.replayed.parentVersion).toBe(result.created.parentVersion);
    const rows = await authPool.query(
      'SELECT id FROM task_subtask WHERE "taskId" = $1',
      [task.id]
    );
    expect(rows.rows).toHaveLength(1);
  } finally {
    await cleanup(actorId, projectId);
  }
});

it("replays a comment removal receipt instead of failing on the already-removed comment", async () => {
  const actorId = randomUUID();
  const projectId = randomUUID();
  await seedFixture(actorId, projectId);

  try {
    const task = await createTask(actorId, projectId);
    const result = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* removalIdempotency() {
          const collaboration = yield* Collaboration;
          const idempotency = yield* Idempotency;
          const comment = yield* collaboration.createComment(
            actorId,
            task.id,
            "Remove me once"
          );
          const removeOnce = () =>
            idempotency.run({
              actorId,
              execute: () => collaboration.removeComment(actorId, comment.id),
              input: { commentId: comment.id },
              key: "comment-remove-0001",
              operation: "comment.remove",
              resultSchema: UndoReceiptSchema,
            });
          const first = yield* removeOnce();
          const replayed = yield* removeOnce();
          return { first, replayed };
        }),
        layers
      )
    );

    expect(result.replayed).toEqual(result.first);
  } finally {
    await cleanup(actorId, projectId);
  }
});
