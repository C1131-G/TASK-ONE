import "server-only";
import { Effect, Layer, Schema } from "effect";

import { AuthSessionLive } from "@/src/server/auth/session";
import { requireAdmin } from "@/src/server/core/admin-action";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import { JobHandlersLive } from "@/src/server/jobs/handlers";
import {
  DeadJobListSchema,
  JobProcessor,
  JobProcessorLive,
} from "@/src/server/jobs/processor";
import { PushTransportLive } from "@/src/server/notifications/push-transport";
import { StorageLive } from "@/src/server/storage/storage";

export const listDeadJobs = async (input: unknown) => {
  const result = await runServerAction(
    input,
    Schema.Struct({ limit: Schema.Number }),
    ({ limit }) =>
      Effect.gen(function* listDeadJobsProgram() {
        const requestHeaders = yield* requestHeadersOrFail;
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
};
