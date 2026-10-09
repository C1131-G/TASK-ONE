import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import { JobHandlersLive } from "../../src/server/jobs/handlers";
import { JobHandlers } from "../../src/server/jobs/job-handlers";
import {
  JobProcessor,
  JobProcessorLive,
} from "../../src/server/jobs/processor";
import { PushTransport } from "../../src/server/notifications/push-transport";
import { Storage } from "../../src/server/storage/storage";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

const _runJobBatch = (workerId: string) =>
  Effect.gen(function* processJobBatch() {
    const processor = yield* JobProcessor;
    return yield* processor.processBatch(workerId, 1);
  });

it("enqueues one idempotent daily maintenance job for worker or scheduler runs", async () => {
  const handlerLayer = Layer.succeed(
    JobHandlers,
    JobHandlers.of({ handle: () => Effect.void })
  );
  const scheduledAt = new Date("2099-03-14T09:00:00.000Z");
  const program = Effect.gen(function* program() {
    const processor = yield* JobProcessor;
    const first = yield* processor.enqueueMaintenance(scheduledAt);
    const second = yield* processor.enqueueMaintenance(scheduledAt);
    return { first, second };
  });

  const result = await Effect.runPromise(
    Effect.provide(program, Layer.provide(JobProcessorLive, handlerLayer))
  );

  try {
    expect(result.first.jobId).toBe(result.second.jobId);
  } finally {
    // Maintenance enqueues a cleanup job and a daily-summary scan; both keys
    // carry the scheduled date.
    await authPool.query('DELETE FROM job WHERE "dedupeKey" LIKE $1', [
      "%2099-03-14%",
    ]);
  }
});

it("lets admins inspect dead jobs without exposing job payloads", async () => {
  const adminId = randomUUID();
  const jobId = randomUUID();
  const email = `${adminId}@dead-job-test.example`;
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'admin\', false)',
    [adminId, "Job Admin", email]
  );
  await authPool.query(
    'INSERT INTO job (id, kind, payload, "dedupeKey", attempts, "deadAt", "lastError") VALUES ($1, $2, $3::json, $4, 8, now(), $5)',
    [
      jobId,
      "test.dead",
      JSON.stringify({ temporaryPassword: "must-not-be-returned" }),
      `dead-${jobId}`,
      "Handler failed (UNAVAILABLE).",
    ]
  );
  const program = Effect.gen(function* program() {
    const processor = yield* JobProcessor;
    return yield* processor.listDeadJobs(adminId, 10);
  });

  try {
    const handlerLayer = Layer.succeed(
      JobHandlers,
      JobHandlers.of({ handle: () => Effect.void })
    );
    const jobs = await Effect.runPromise(
      Effect.provide(program, Layer.provide(JobProcessorLive, handlerLayer))
    );
    expect(jobs).toContainEqual(
      expect.objectContaining({
        attempts: 8,
        id: jobId,
        kind: "test.dead",
      })
    );
    expect(JSON.stringify(jobs)).not.toContain("must-not-be-returned");
  } finally {
    await authPool.query("DELETE FROM job WHERE id = $1", [jobId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [adminId]);
  }
});

it("deletes replaced avatar objects through the registered storage job", async () => {
  const id = randomUUID();
  const objectKey = `company/avatars/${randomUUID()}/old.webp`;
  const deletedKeys: string[] = [];
  await authPool.query(
    'INSERT INTO job (id, kind, payload, "dedupeKey", "availableAt") VALUES ($1, $2, $3::json, $4, now())',
    [
      id,
      "storage.delete-avatar",
      JSON.stringify({ objectKey }),
      `avatar-delete-${id}`,
    ]
  );
  const storageLayer = Layer.succeed(
    Storage,
    Storage.of({
      copyObject: () => Effect.void,
      deleteObject: (key) => {
        deletedKeys.push(key);
        return Effect.void;
      },
      signDownload: () => Effect.succeed("https://private.example/download"),
      signPreview: () => Effect.succeed("https://private.example/preview"),
      signUpload: () => Effect.succeed("https://private.example/upload"),
      verifyObject: () => Effect.void,
    })
  );
  const pushLayer = Layer.succeed(
    PushTransport,
    PushTransport.of({ send: () => Effect.succeed("delivered") })
  );
  const handlersLayer = Layer.provide(
    JobHandlersLive,
    Layer.merge(storageLayer, pushLayer)
  );

  try {
    const program = Effect.gen(function* program() {
      const processor = yield* JobProcessor;
      return yield* processor.processBatch(`test-worker-${id}`, 1);
    });
    const result = await Effect.runPromise(
      Effect.provide(program, Layer.provide(JobProcessorLive, handlersLayer))
    );

    expect(result).toEqual({
      claimed: 1,
      completed: 1,
      deadLettered: 0,
      retried: 0,
    });
    expect(deletedKeys).toEqual([objectKey]);
  } finally {
    await authPool.query("DELETE FROM job WHERE id = $1", [id]);
  }
});
