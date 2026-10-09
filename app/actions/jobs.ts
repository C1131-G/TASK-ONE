"use server";

import { Effect, Layer, Schema } from "effect";
import { headers } from "next/headers";

import { AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import { requireAdmin } from "@/src/server/core/admin-action";
import { runServerAction } from "@/src/server/core/server-action";
import { JobHandlersLive } from "@/src/server/jobs/handlers";
import {
  DeadJobListSchema,
  JobProcessor,
  JobProcessorLive,
} from "@/src/server/jobs/processor";
import { PushTransportLive } from "@/src/server/notifications/push-transport";
import { StorageLive } from "@/src/server/storage/storage";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listDeadJobsAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({ limit: Schema.Number }),
    ({ limit }) =>
      Effect.gen(function* listDeadJobs() {
        const requestHeaders = yield* Effect.tryPromise({
          catch: () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            }),
          try: () => headers(),
        });
        const user = yield* requireAdmin(requestHeaders);
        const processor = yield* JobProcessor;
        return yield* processor.listDeadJobs(user.id, limit);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(
          Layer.provide(
            JobProcessorLive,
            Layer.provide(
              JobHandlersLive,
              Layer.merge(StorageLive, PushTransportLive)
            )
          )
        )
      ),
    undefined,
    DeadJobListSchema
  );
  return result;
}
