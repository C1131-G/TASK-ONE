import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer, Schema } from "effect";

import { db } from "../../src/prisma/db";
import { authPool } from "../../src/server/auth/database";
import { AppError } from "../../src/server/core/action-result";
import {
  Idempotency,
  IdempotencyLive,
  IdempotencyServiceLive,
} from "../../src/server/core/idempotency";
import { IdempotencyResponseStore } from "../../src/server/core/idempotency-response-store";
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

it("rolls back a command when its idempotency result cannot be serialized", async () => {
  const actorId = randomUUID();
  const jobId = randomUUID();
  const dedupeKey = `idempotency-rollback-${jobId}`;
  await db.orm.public.User.create({
    email: `${actorId}@idempotency-rollback.example`,
    id: actorId,
    name: "Rollback Employee",
  });
  const program = Effect.gen(function* runUnserializableCommand() {
    const idempotency = yield* Idempotency;
    return yield* idempotency.run({
      actorId,
      execute: () =>
        Effect.promise(async () => {
          await db.orm.public.Job.create({
            availableAt: new Date(),
            dedupeKey,
            id: jobId,
            kind: "test.idempotency-rollback",
            payload: {},
          });
          return { value: (() => "not-json") as unknown as string };
        }),
      input: {},
      key: `rollback-${jobId}`,
      operation: "test.rollback",
      resultSchema: Schema.Struct({ value: Schema.String }),
    });
  });

  try {
    const result = await Effect.runPromise(
      Effect.result(Effect.provide(program, IdempotencyLive))
    );

    expect(result._tag).toBe("Failure");
    expect(await db.orm.public.Job.where({ dedupeKey }).first()).toBeNull();
  } finally {
    await db.orm.public.IdempotencyKey.where({ actorId }).deleteAll();
    await db.orm.public.Job.where({ dedupeKey }).deleteAll();
    await db.orm.public.User.where({ id: actorId }).delete();
  }
});

it("rolls back a command when persisting its idempotency response fails", async () => {
  const actorId = randomUUID();
  const jobId = randomUUID();
  const dedupeKey = `idempotency-persist-failure-${jobId}`;
  await db.orm.public.User.create({
    email: `${actorId}@idempotency-persist-failure.example`,
    id: actorId,
    name: "Persistence Failure Employee",
  });
  const responseStoreLayer = Layer.succeed(
    IdempotencyResponseStore,
    IdempotencyResponseStore.of({
      persist: () =>
        Effect.fail(
          new AppError({
            code: "UNAVAILABLE",
            message: "Injected response persistence failure.",
          })
        ),
    })
  );
  const program = Effect.gen(function* runWithResponseFailure() {
    const idempotency = yield* Idempotency;
    return yield* idempotency.run({
      actorId,
      execute: () =>
        Effect.promise(async () => {
          await db.orm.public.Job.create({
            availableAt: new Date(),
            dedupeKey,
            id: jobId,
            kind: "test.idempotency-persist-failure",
            payload: {},
          });
          return { accepted: true };
        }),
      input: {},
      key: `persist-failure-${jobId}`,
      operation: "test.persist-failure",
      resultSchema: Schema.Struct({ accepted: Schema.Boolean }),
    });
  });

  try {
    const result = await Effect.runPromise(
      Effect.result(
        Effect.provide(
          program,
          Layer.provide(IdempotencyServiceLive, responseStoreLayer)
        )
      )
    );
    expect(result._tag).toBe("Failure");
    expect(await db.orm.public.Job.where({ dedupeKey }).first()).toBeNull();
    expect(
      await db.orm.public.IdempotencyKey.where({ actorId }).first()
    ).toBeNull();
  } finally {
    await db.orm.public.IdempotencyKey.where({ actorId }).deleteAll();
    await db.orm.public.Job.where({ dedupeKey }).deleteAll();
    await db.orm.public.User.where({ id: actorId }).delete();
  }
});
