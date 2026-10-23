import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Schema } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  Collaboration,
  CollaborationLive,
} from "../../src/server/collaboration/service";
import { LONG_TEXT_MAX_LENGTH } from "../../src/server/core/text-limits";
import { SubtaskFieldsSchema } from "../../src/server/tasks/subtask-contracts";
import { TASK_DESCRIPTION_MAX_LENGTH } from "../../src/server/work/work-contracts";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

const EXPECTED_LIMIT = 20_000;

it("uses one 20,000 character limit for descriptions, comments and subtasks", () => {
  expect(LONG_TEXT_MAX_LENGTH).toBe(EXPECTED_LIMIT);
  expect(TASK_DESCRIPTION_MAX_LENGTH).toBe(LONG_TEXT_MAX_LENGTH);
});

const withDescription = (description: string) => ({
  assigneeId: null,
  description,
  dueDate: null,
  title: "Subtask",
});

it("accepts a subtask description at the limit and rejects one over it", () => {
  const isValid = Schema.is(SubtaskFieldsSchema);

  expect(isValid(withDescription("a".repeat(EXPECTED_LIMIT)))).toBe(true);
  expect(isValid(withDescription("a".repeat(EXPECTED_LIMIT + 1)))).toBe(false);
});

it("accepts a comment at the limit and rejects one over it", async () => {
  const actorId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [actorId, "Limit Author", `${actorId}@text-limit.example`, "employee"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `L${randomUUID().slice(0, 6)}`, "Text limit project"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, 1, $3, $4)',
    [taskId, projectId, "Text limit task", actorId]
  );

  const post = (body: string) =>
    Effect.runPromise(
      Effect.provide(
        Effect.gen(function* postComment() {
          const collaboration = yield* Collaboration;
          return yield* collaboration.createComment(actorId, taskId, body);
        }),
        CollaborationLive
      )
    );

  try {
    const atLimit = await post("a".repeat(EXPECTED_LIMIT));
    expect(atLimit.body).toHaveLength(EXPECTED_LIMIT);
    await expect(post("a".repeat(EXPECTED_LIMIT + 1))).rejects.toThrow();
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
