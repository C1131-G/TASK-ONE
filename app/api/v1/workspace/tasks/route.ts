import { Effect } from "effect";

import { taskCreateRoute } from "@/src/mobile-api/routes-tasks";
import { respondWith } from "@/src/server/api/http-response";
import { readRouteInput } from "@/src/server/api/route-input";
import { addTask } from "@/src/server/api/tasks/task-update";
import { AuthSessionLive } from "@/src/server/auth/session";
import { IdempotencyLive } from "@/src/server/core/idempotency";

export const POST = (request: Request): Promise<Response> =>
  respondWith(
    Effect.gen(function* handle() {
      const input = yield* readRouteInput(taskCreateRoute, request);
      return yield* addTask(request.headers, input.body, input.idempotencyKey);
    }).pipe(Effect.provide(AuthSessionLive), Effect.provide(IdempotencyLive))
  );
