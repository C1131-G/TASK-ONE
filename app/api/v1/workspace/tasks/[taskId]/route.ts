import { Effect } from "effect";

import {
  taskChangeRoute,
  taskContextRoute,
} from "@/src/mobile-api/routes-tasks";
import { respondWith } from "@/src/server/api/http-response";
import { readRouteInput } from "@/src/server/api/route-input";
import { readTaskContext } from "@/src/server/api/tasks/task-context";
import { changeTask } from "@/src/server/api/tasks/task-update";
import { AuthSessionLive } from "@/src/server/auth/session";
import { IdempotencyLive } from "@/src/server/core/idempotency";

interface TaskRouteContext {
  params: Promise<{ taskId: string }>;
}

export const GET = async (
  request: Request,
  context: TaskRouteContext
): Promise<Response> => {
  const params = await context.params;
  return respondWith(
    Effect.gen(function* handle() {
      const input = yield* readRouteInput(taskContextRoute, request, params);
      return yield* readTaskContext(request.headers, input.params.taskId);
    }).pipe(Effect.provide(AuthSessionLive))
  );
};

export const PATCH = async (
  request: Request,
  context: TaskRouteContext
): Promise<Response> => {
  const params = await context.params;
  return respondWith(
    Effect.gen(function* handle() {
      const input = yield* readRouteInput(taskChangeRoute, request, params);
      return yield* changeTask(
        request.headers,
        input.params.taskId,
        input.body,
        input.idempotencyKey
      );
    }).pipe(Effect.provide(AuthSessionLive), Effect.provide(IdempotencyLive))
  );
};
