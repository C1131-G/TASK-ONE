import { Effect } from "effect";

import { subtaskChangeRoute } from "@/src/mobile-api/routes-tasks";
import { respondWith } from "@/src/server/api/http-response";
import { readRouteInput } from "@/src/server/api/route-input";
import { changeTaskSubtask } from "@/src/server/api/tasks/task-subtasks";
import { AuthSessionLive } from "@/src/server/auth/session";
import { IdempotencyLive } from "@/src/server/core/idempotency";

export const PATCH = async (
  request: Request,
  context: { params: Promise<{ subtaskId: string; taskId: string }> }
): Promise<Response> => {
  const params = await context.params;
  return respondWith(
    Effect.gen(function* handle() {
      const input = yield* readRouteInput(subtaskChangeRoute, request, params);
      return yield* changeTaskSubtask(
        request.headers,
        input.params.taskId,
        input.params.subtaskId,
        input.body,
        input.idempotencyKey
      );
    }).pipe(Effect.provide(AuthSessionLive), Effect.provide(IdempotencyLive))
  );
};
