import { randomUUID, timingSafeEqual } from "node:crypto";

import { Effect, Layer, Schema } from "effect";

import { runServerAction } from "@/src/server/core/server-action";
import { JobHandlersLive } from "@/src/server/jobs/handlers";
import { JobProcessor, JobProcessorLive } from "@/src/server/jobs/processor";
import { PushTransportLive } from "@/src/server/notifications/push-transport";
import { StorageLive } from "@/src/server/storage/storage";

const BatchSchema = Schema.Struct({ limit: Schema.Number });

const validSchedulerToken = (request: Request): boolean => {
  const expected = process.env["SCHEDULER_TOKEN"];
  const authorization = request.headers.get("authorization");
  const supplied = authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : undefined;
  if (!expected || expected.length < 32 || !supplied) {
    return false;
  }

  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
};

// eslint-disable-next-line func-style -- Next route handler remains a named export.
export async function POST(request: Request) {
  if (!validSchedulerToken(request)) {
    const requestId = randomUUID();
    return Response.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "Not authorized.",
          requestId,
        },
        ok: false,
      },
      { headers: { "cache-control": "no-store" }, status: 401 }
    );
  }

  let input: unknown;
  try {
    const body: unknown = await request.json();
    input =
      typeof body === "object" && body !== null && "limit" in body
        ? { limit: Number(body.limit) }
        : { limit: 10 };
  } catch {
    input = { limit: 10 };
  }

  const result = await runServerAction(input, BatchSchema, ({ limit }) =>
    Effect.gen(function* processScheduledBatch() {
      const processor = yield* JobProcessor;
      yield* processor.enqueueMaintenance(new Date());
      const batch = yield* processor.processBatch(
        `scheduler-${crypto.randomUUID()}`,
        limit
      );
      return batch;
    }).pipe(
      Effect.provide(
        Layer.provide(
          JobProcessorLive,
          Layer.provide(
            JobHandlersLive,
            Layer.merge(StorageLive, PushTransportLive)
          )
        )
      )
    )
  );

  let status = 503;
  if (result.ok) {
    status = 200;
  } else if (result.error.code === "VALIDATION_FAILED") {
    status = 400;
  }
  return Response.json(result, {
    headers: { "cache-control": "no-store" },
    status,
  });
}
