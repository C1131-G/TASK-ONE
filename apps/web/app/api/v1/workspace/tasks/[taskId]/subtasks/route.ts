import { Effect } from "effect";

import { subtaskAddRoute } from "@/src/mobile-api/routes-tasks";
import { respondWith } from "@/src/server/api/http-response";
import { readRouteInput } from "@/src/server/api/route-input";
import { addTaskSubtask } from "@/src/server/api/tasks/task-subtasks";
import { AuthSessionLive } from "@/src/server/auth/session";
import { IdempotencyLive } from "@/src/server/core/idempotency";

export const POST = async (
  request: Request,
  context: { params: Promise<{ taskId: string }> }
): Promise<Response> => {
  const params = await context.params;
  return respondWith(
    Effect.gen(function* handle() {
      const input = yield* readRouteInput(subtaskAddRoute, request, params);
      return yield* addTaskSubtask(
        request.headers,
        input.params.taskId,
        input.body,
        input.idempotencyKey
      );
    }).pipe(Effect.provide(AuthSessionLive), Effect.provide(IdempotencyLive))
  );
};
