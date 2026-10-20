import "dotenv/config";
import { setTimeout as delay } from "node:timers/promises";

import { Cause, Effect, Exit, Layer } from "effect";

import { authPool } from "../src/server/auth/database";
import { logger } from "../src/server/core/logger";
import { JobHandlersLive } from "../src/server/jobs/job-handlers-live";
import { JobProcessor, JobProcessorLive } from "../src/server/jobs/processor";
import { PushTransportLive } from "../src/server/notifications/push-transport";
import { StorageLive } from "../src/server/storage/storage";

const workerId = `worker-${crypto.randomUUID()}`;
const processorLayer = Layer.provide(
  JobProcessorLive,
  Layer.provide(JobHandlersLive, Layer.merge(StorageLive, PushTransportLive))
);
const IDLE_DELAY_MS = 1000;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const BATCH_SIZE = 25;

const stopController = new AbortController();
const stopSignal = stopController.signal;
const stop = () => stopController.abort();
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

// Resolves early on shutdown so a long backoff never delays SIGTERM handling.
const pause = async (milliseconds: number): Promise<void> => {
  try {
    await delay(milliseconds, undefined, { signal: stopSignal });
  } catch {
    // The delay rejects only when shutdown aborts it; the loop then exits.
  }
};

const runBatch = () =>
  Effect.runPromiseExit(
    Effect.gen(function* processNextBatch() {
      const processor = yield* JobProcessor;
      yield* processor.enqueueMaintenance(new Date());
      return yield* processor.processBatch(workerId, BATCH_SIZE);
    }).pipe(Effect.provide(processorLayer))
  );

try {
  let backoffMs = INITIAL_BACKOFF_MS;
  while (!stopSignal.aborted) {
    // This dedicated process intentionally awaits one bounded batch at a time.
    // eslint-disable-next-line no-await-in-loop
    const exit = await runBatch();
    if (Exit.isSuccess(exit)) {
      backoffMs = INITIAL_BACKOFF_MS;
      logger.info("Processed a job batch.", { workerId, ...exit.value });
      if (exit.value.claimed === 0) {
        // eslint-disable-next-line no-await-in-loop
        await pause(IDLE_DELAY_MS);
      }
      continue;
    }
    // A failed batch (database restart, provider outage) must not stop the
    // worker; back off so a persistent failure does not spin the CPU.
    logger.error("A job batch failed; retrying after a backoff.", {
      cause: Cause.pretty(exit.cause),
      error: Cause.squash(exit.cause),
      retryInMs: backoffMs,
      workerId,
    });
    // eslint-disable-next-line no-await-in-loop
    await pause(backoffMs);
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
  }
  logger.info("The durable worker stopped after a shutdown signal.", {
    workerId,
  });
} finally {
  await authPool.end();
}
