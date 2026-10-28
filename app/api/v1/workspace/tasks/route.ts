import { Effect } from "effect";

import { taskCreateRoute, taskListRoute } from "@/src/mobile-api/routes-tasks";
import { respondWith } from "@/src/server/api/http-response";
import { readRouteInput } from "@/src/server/api/route-input";
import { readTaskList } from "@/src/server/api/tasks/task-list";
import { addTask } from "@/src/server/api/tasks/task-update";
import { AuthSessionLive } from "@/src/server/auth/session";
import { IdempotencyLive } from "@/src/server/core/idempotency";

export const GET = (request: Request): Promise<Response> =>
  respondWith(
    Effect.gen(function* handle() {
      const { query } = yield* readRouteInput(taskListRoute, request);
      return yield* readTaskList(request.headers, query);
    }).pipe(Effect.provide(AuthSessionLive))
  );

export const POST = (request: Request): Promise<Response> =>
  respondWith(
    Effect.gen(function* handle() {
      const input = yield* readRouteInput(taskCreateRoute, request);
      return yield* addTask(request.headers, input.body, input.idempotencyKey);
    }).pipe(Effect.provide(AuthSessionLive), Effect.provide(IdempotencyLive))
  );
