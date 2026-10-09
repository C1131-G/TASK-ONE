import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import { AppError } from "../../src/server/core/action-result";
import { JobHandlersLive } from "../../src/server/jobs/handlers";
import { JobHandlers } from "../../src/server/jobs/job-handlers";
import {
  JobProcessor,
  JobProcessorLive,
  makeJobProcessorLayer,
} from "../../src/server/jobs/processor";
import { PushTransport } from "../../src/server/notifications/push-transport";
import { Storage } from "../../src/server/storage/storage";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

const runJobBatch = (workerId: string) =>
  Effect.gen(function* processJobBatch() {
    const processor = yield* JobProcessor;
    return yield* processor.processBatch(workerId, 1);
  });

it("claims and completes a due durable job through the processor", async () => {
  const id = randomUUID();
  let delivered = false;
  await authPool.query(
    'INSERT INTO job (id, kind, payload, "dedupeKey", "availableAt") VALUES ($1, $2, $3::json, $4, $5)',
    [
      id,
      "test.delivery",
      JSON.stringify({ message: "hello" }),
      `job-${id}`,
      new Date("2000-01-01T00:00:00Z"),
    ]
  );

  const handlerLayer = Layer.succeed(
    JobHandlers,
    JobHandlers.of({
      handle: (kind, payload) => {
        delivered =
          kind === "test.delivery" &&
          typeof payload === "object" &&
          payload !== null &&
          !Array.isArray(payload) &&
          "message" in payload &&
          payload.message === "hello";
        return Effect.void;
      },
    })
  );
  const program = Effect.gen(function* program() {
    const processor = yield* JobProcessor;
    return yield* processor.processBatch(`test-worker-${id}`, 1);
  });

  try {
    const result = await Effect.runPromise(
      Effect.provide(program, Layer.provide(JobProcessorLive, handlerLayer))
    );
    expect(result).toEqual({
      claimed: 1,
      completed: 1,
      deadLettered: 0,
      retried: 0,
    });
    expect(delivered).toBe(true);
  } finally {
    await authPool.query("DELETE FROM job WHERE id = $1", [id]);
  }
});

it("runs a due job once when two workers claim concurrently", async () => {
  const id = randomUUID();
  let deliveries = 0;
  await authPool.query(
    'INSERT INTO job (id, kind, payload, "dedupeKey", "availableAt") VALUES ($1, $2, $3::json, $4, $5)',
    [
      id,
      "test.concurrent",
      JSON.stringify({}),
      `job-${id}`,
      new Date("2000-01-01T00:00:00Z"),
    ]
  );

  const handlerLayer = Layer.succeed(
    JobHandlers,
    JobHandlers.of({
      handle: () =>
        Effect.gen(function* handleConcurrentJob() {
          deliveries += 1;
          yield* Effect.sleep("30 millis");
        }),
    })
  );
  try {
    await Promise.all([
      Effect.runPromise(
        Effect.provide(
          runJobBatch(`worker-a-${id}`),
          Layer.provide(JobProcessorLive, handlerLayer)
        )
      ),
      Effect.runPromise(
        Effect.provide(
          runJobBatch(`worker-b-${id}`),
          Layer.provide(JobProcessorLive, handlerLayer)
        )
      ),
    ]);
    expect(deliveries).toBe(1);
  } finally {
    await authPool.query("DELETE FROM job WHERE id = $1", [id]);
  }
});

it("renews a job lease while a handler is running", async () => {
  const id = randomUUID();
  let handled = false;
  await authPool.query(
    'INSERT INTO job (id, kind, payload, "dedupeKey", "availableAt") VALUES ($1, $2, $3::json, $4, $5)',
    [
      id,
      "test.long-running",
      JSON.stringify({}),
      `job-${id}`,
      new Date("2000-01-01T00:00:00Z"),
    ]
  );
  const handlerLayer = Layer.succeed(
    JobHandlers,
    JobHandlers.of({
      handle: () =>
        Effect.gen(function* handleLongJob() {
          yield* Effect.sleep("100 millis");
          handled = true;
        }),
    })
  );
  const processorLayer = makeJobProcessorLayer({
    leaseDurationMs: 30,
    renewalIntervalMs: 5,
  });
  const program = Effect.gen(function* program() {
    const processor = yield* JobProcessor;
    return yield* processor.processBatch(`test-worker-${id}`, 1);
  });

  try {
    const result = await Effect.runPromise(
      Effect.provide(program, Layer.provide(processorLayer, handlerLayer))
    );
    expect(result.completed).toBe(1);
    expect(handled).toBe(true);
  } finally {
    await authPool.query("DELETE FROM job WHERE id = $1", [id]);
  }
});

it("releases a failed job with a bounded retry instead of losing the lease", async () => {
  const id = randomUUID();
  await authPool.query(
    'INSERT INTO job (id, kind, payload, "dedupeKey", "availableAt") VALUES ($1, $2, $3::json, $4, $5)',
    [
      id,
      "test.failure",
      JSON.stringify({}),
      `job-${id}`,
      new Date("2001-01-01T00:00:00Z"),
    ]
  );

  const handlerLayer = Layer.succeed(
    JobHandlers,
    JobHandlers.of({
      handle: () =>
        Effect.fail(
          new AppError({
            code: "UNAVAILABLE",
            message: "Mock delivery failed.",
          })
        ),
    })
  );
  const program = Effect.gen(function* program() {
    const processor = yield* JobProcessor;
    return yield* processor.processBatch(`test-worker-${id}`, 1);
  });

  try {
    const result = await Effect.runPromise(
      Effect.provide(program, Layer.provide(JobProcessorLive, handlerLayer))
    );
    expect(result).toEqual({
      claimed: 1,
      completed: 0,
      deadLettered: 0,
      retried: 1,
    });
  } finally {
    await authPool.query("DELETE FROM job WHERE id = $1", [id]);
  }
});

it("recovers an expired worker lease and completes its durable job", async () => {
  const id = randomUUID();
  const leaseExpiredAt = new Date(Date.now() - 120_000);
  let handled = false;
  await authPool.query(
    'INSERT INTO job (id, kind, payload, "dedupeKey", "availableAt", "leaseOwner", "leasedUntil", attempts) VALUES ($1, $2, $3::json, $4, $5, $6, $7, 1)',
    [
      id,
      "test.recovered",
      JSON.stringify({ marker: "recover" }),
      `job-${id}`,
      new Date("2003-01-01T00:00:00Z"),
      "worker-that-stopped",
      leaseExpiredAt,
    ]
  );

  const handlerLayer = Layer.succeed(
    JobHandlers,
    JobHandlers.of({
      handle: (kind, payload) => {
        handled =
          kind === "test.recovered" &&
          typeof payload === "object" &&
          payload !== null &&
          !Array.isArray(payload) &&
          "marker" in payload &&
          payload.marker === "recover";
        return Effect.void;
      },
    })
  );
  const program = Effect.gen(function* recoverLease() {
    const processor = yield* JobProcessor;
    return yield* processor.processBatch(`recovery-worker-${id}`, 1);
  });

  try {
    const result = await Effect.runPromise(
      Effect.provide(program, Layer.provide(JobProcessorLive, handlerLayer))
    );
    expect(result).toEqual({
      claimed: 1,
      completed: 1,
      deadLettered: 0,
      retried: 0,
    });
    expect(handled).toBe(true);
  } finally {
    await authPool.query("DELETE FROM job WHERE id = $1", [id]);
  }
});

it("dead-letters permanent job failures without retrying them", async () => {
  const id = randomUUID();
  await authPool.query(
    'INSERT INTO job (id, kind, payload, "dedupeKey", "availableAt") VALUES ($1, $2, $3::json, $4, $5)',
    [
      id,
      "test.invalid",
      JSON.stringify({}),
      `job-${id}`,
      new Date("2002-01-01T00:00:00Z"),
    ]
  );
  const handlerLayer = Layer.succeed(
    JobHandlers,
    JobHandlers.of({
      handle: () =>
        Effect.fail(
          new AppError({
            code: "NOT_FOUND",
            message: "This job kind is not registered.",
          })
        ),
    })
  );
  const program = Effect.gen(function* program() {
    const processor = yield* JobProcessor;
    return yield* processor.processBatch(`test-worker-${id}`, 1);
  });

  try {
    const result = await Effect.runPromise(
      Effect.provide(program, Layer.provide(JobProcessorLive, handlerLayer))
    );
    const job = await authPool.query(
      'SELECT "attempts", "deadAt" FROM job WHERE id = $1',
      [id]
    );
    expect(result).toEqual({
      claimed: 1,
      completed: 0,
      deadLettered: 1,
      retried: 0,
    });
    expect(job.rows[0]).toMatchObject({ attempts: 1 });
    expect(job.rows[0]?.deadAt).not.toBeNull();
  } finally {
    await authPool.query("DELETE FROM job WHERE id = $1", [id]);
  }
});

it("runs expired upload cleanup from the registered worker handler", async () => {
  const suffix = randomUUID();
  const actorId = randomUUID();
  const projectId = randomUUID();
  const taskId = randomUUID();
  const intentId = randomUUID();
  const jobId = randomUUID();
  const objectKey = `expired/${intentId}`;
  const email = `${actorId}@job-upload-test.example`;
  const deletedKeys: string[] = [];
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [actorId, "Upload Owner", email, "employee"]
  );
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `J${suffix.slice(0, 6)}`, "Job upload project"]
  );
  await authPool.query(
    'INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, 1, $3, $4)',
    [taskId, projectId, "Job upload task", actorId]
  );
  await authPool.query(
    'INSERT INTO upload_intent (id, "ownerId", "taskId", "projectId", "objectKey", "fileName", "contentType", "sizeBytes", state, "expiresAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() - interval \'1 hour\')',
    [
      intentId,
      actorId,
      taskId,
      projectId,
      objectKey,
      "expired.pdf",
      "application/pdf",
      20,
      "pending",
    ]
  );
  await authPool.query(
    'INSERT INTO job (id, kind, payload, "dedupeKey", "availableAt") VALUES ($1, $2, $3::json, $4, now())',
    [
      jobId,
      "storage.cleanup-expired-uploads",
      JSON.stringify({}),
      `job-${jobId}`,
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
      return yield* processor.processBatch(`test-worker-${jobId}`, 1);
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
    await authPool.query("DELETE FROM job WHERE id = $1", [jobId]);
    await authPool.query('DELETE FROM upload_intent WHERE "ownerId" = $1', [
      actorId,
    ]);
    await authPool.query("DELETE FROM task WHERE id = $1", [taskId]);
    await authPool.query("DELETE FROM project WHERE id = $1", [projectId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [actorId]);
  }
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
