import { Effect } from "effect";

import { myTimerRoute } from "@/src/mobile-api/routes-tasks";
import { respondWith } from "@/src/server/api/http-response";
import { readRouteInput } from "@/src/server/api/route-input";
import { getMyTimer } from "@/src/server/api/tasks/task-timer";
import { AuthSessionLive } from "@/src/server/auth/session";
import { TimeTrackingLive } from "@/src/server/time/time-tracking";

export const GET = (request: Request): Promise<Response> =>
  respondWith(
    Effect.gen(function* handle() {
      yield* readRouteInput(myTimerRoute, request);
      return yield* getMyTimer(request.headers);
    }).pipe(Effect.provide(AuthSessionLive), Effect.provide(TimeTrackingLive))
  );
