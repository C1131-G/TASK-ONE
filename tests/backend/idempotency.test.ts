import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  Idempotency,
  IdempotencyLive,
} from "../../src/server/core/idempotency";
import {
  DiscoveryManagement,
  DiscoveryManagementLive,
} from "../../src/server/preferences/discovery-management";
import {
  CreatedTaskSchema,
  WorkManagement,
  WorkManagementLive,
} from "../../src/server/work/work-management";

it("replays a matching task-create request without creating a second task", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  const email = `${actorId}@idempotency-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [actorId, "Idempotency Employee", email]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `I${suffix.slice(0, 6)}`, "Idempotency project"]
  );

  try {
    const program = Effect.gen(function* runIdempotentCreate() {
      const idempotency = yield* Idempotency;
      const work = yield* WorkManagement;
      const discovery = yield* DiscoveryManagement;
      const input = {
        assigneeIds: [],
        description: null,
        dueDate: null,
        priority: "medium" as const,
        projectId,
        title: "Only one task from a repeated request",
      };
      const resultSchema = CreatedTaskSchema;
      const createTask = () => work.createTask(actorId, input);
      const first = yield* idempotency.run({
        actorId,
        execute: createTask,
        input,
        key: "task-create-request-0001",
        operation: "task.create",
        resultSchema,
      });
      const replay = yield* idempotency.run({
        actorId,
        execute: createTask,
        input,
        key: "task-create-request-0001",
        operation: "task.create",
        resultSchema,
      });
      const mismatched = yield* Effect.result(
        idempotency.run({
          actorId,
          execute: createTask,
          input: { ...input, title: "Different payload" },
          key: "task-create-request-0001",
          operation: "task.create",
          resultSchema,
        })
      );
      const search = yield* discovery.searchWorkspace(
        actorId,
        "Only one task from a repeated request"
      );
      return { first, mismatched, replay, search };
    });
    const result = await Effect.runPromise(
      Effect.provide(
        program,
        Layer.mergeAll(
          IdempotencyLive,
          WorkManagementLive,
          DiscoveryManagementLive
        )
      )
    );

    expect(result.replay.id).toBe(result.first.id);
    expect(result.mismatched._tag).toBe("Failure");
    expect(result.search.tasks).toHaveLength(1);
  } finally {
    await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query('DELETE FROM "idempotency_key" WHERE "actorId" = $1', [
      actorId,
    ]);
    await authPool.query('DELETE FROM task WHERE "projectId" = $1', [
      projectId,
    ]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
});
