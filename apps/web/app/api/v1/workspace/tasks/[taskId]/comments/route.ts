import { Effect } from "effect";

import { taskCommentRoute } from "@/src/mobile-api/routes-tasks";
import { respondWith } from "@/src/server/api/http-response";
import { readRouteInput } from "@/src/server/api/route-input";
import { addTaskComment } from "@/src/server/api/tasks/task-comments";
import { AuthSessionLive } from "@/src/server/auth/session";
import { IdempotencyLive } from "@/src/server/core/idempotency";

export const POST = async (
  request: Request,
  context: { params: Promise<{ taskId: string }> }
): Promise<Response> => {
  const params = await context.params;
  return respondWith(
    Effect.gen(function* handle() {
      const input = yield* readRouteInput(taskCommentRoute, request, params);
      return yield* addTaskComment(
        request.headers,
        input.params.taskId,
        input.body,
        input.idempotencyKey
      );
    }).pipe(Effect.provide(AuthSessionLive), Effect.provide(IdempotencyLive))
  );
};
