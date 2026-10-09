import "dotenv/config";
import { Effect, Layer } from "effect";

import { JobHandlersLive } from "../src/server/jobs/handlers";
import { JobProcessor, JobProcessorLive } from "../src/server/jobs/processor";
import { PushTransportLive } from "../src/server/notifications/push-transport";
import { StorageLive } from "../src/server/storage/storage";

const workerId = `worker-${crypto.randomUUID()}`;
const processorLayer = Layer.provide(
  JobProcessorLive,
  Layer.provide(JobHandlersLive, Layer.merge(StorageLive, PushTransportLive))
);
let stopping = false;

process.once("SIGINT", () => {
  stopping = true;
});
process.once("SIGTERM", () => {
  stopping = true;
});

while (true) {
  if (stopping) {
    break;
  }
  // This dedicated process intentionally awaits one bounded batch at a time.
  // eslint-disable-next-line no-await-in-loop
  const result = await Effect.runPromise(
    Effect.gen(function* result() {
      const processor = yield* JobProcessor;
      yield* processor.enqueueMaintenance(new Date());
      return yield* processor.processBatch(workerId, 25);
    }).pipe(Effect.provide(processorLayer))
  );

  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.claimed === 0) {
    // eslint-disable-next-line no-await-in-loop
    await Effect.runPromise(Effect.sleep("1 second"));
  }
}
