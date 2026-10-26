import { Effect } from "effect";

import { stopMyTimerRoute } from "@/src/mobile-api/routes-tasks";
import { respondWith } from "@/src/server/api/http-response";
import { readRouteInput } from "@/src/server/api/route-input";
import { stopMyTimer } from "@/src/server/api/tasks/task-timer";
import { AuthSessionLive } from "@/src/server/auth/session";
import { IdempotencyLive } from "@/src/server/core/idempotency";
import { TimeTrackingLive } from "@/src/server/time/time-tracking";

export const POST = (request: Request): Promise<Response> =>
  respondWith(
    Effect.gen(function* handle() {
      const { idempotencyKey } = yield* readRouteInput(
        stopMyTimerRoute,
        request
      );
      return yield* stopMyTimer(request.headers, idempotencyKey);
    }).pipe(
      Effect.provide(AuthSessionLive),
      Effect.provide(IdempotencyLive),
      Effect.provide(TimeTrackingLive)
    )
  );
