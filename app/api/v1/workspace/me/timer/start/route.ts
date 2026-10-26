import { Effect } from "effect";

import { startMyTimerRoute } from "@/src/mobile-api/routes-tasks";
import { respondWith } from "@/src/server/api/http-response";
import { readRouteInput } from "@/src/server/api/route-input";
import { startMyTimer } from "@/src/server/api/tasks/task-timer";
import { AuthSessionLive } from "@/src/server/auth/session";
import { IdempotencyLive } from "@/src/server/core/idempotency";
import { TimeTrackingLive } from "@/src/server/time/time-tracking";

export const POST = (request: Request): Promise<Response> =>
  respondWith(
    Effect.gen(function* handle() {
      const { body, idempotencyKey } = yield* readRouteInput(
        startMyTimerRoute,
        request
      );
      return yield* startMyTimer(request.headers, body, idempotencyKey);
    }).pipe(
      Effect.provide(AuthSessionLive),
      Effect.provide(IdempotencyLive),
      Effect.provide(TimeTrackingLive)
    )
  );
