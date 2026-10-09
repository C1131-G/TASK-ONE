import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import { AppError } from "../../src/server/core/action-result";
import { JobHandlers } from "../../src/server/jobs/job-handlers";
import {
  JobProcessor,
  JobProcessorLive,
  makeJobProcessorLayer,
} from "../../src/server/jobs/processor";

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
