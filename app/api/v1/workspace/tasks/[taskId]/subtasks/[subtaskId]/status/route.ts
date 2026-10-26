import { Effect } from "effect";

import { subtaskStatusRoute } from "@/src/mobile-api/routes-tasks";
import { respondWith } from "@/src/server/api/http-response";
import { readRouteInput } from "@/src/server/api/route-input";
import { setTaskSubtaskStatus } from "@/src/server/api/tasks/task-subtasks";
import { AuthSessionLive } from "@/src/server/auth/session";
import { IdempotencyLive } from "@/src/server/core/idempotency";

interface SubtaskStatusRouteContext {
  params: Promise<{ subtaskId: string; taskId: string }>;
}

// The app calls the task parameter `{id}`, while the folder is `[taskId]`.
export const POST = async (
  request: Request,
  context: SubtaskStatusRouteContext
): Promise<Response> => {
  const params = await context.params;
  return respondWith(
    Effect.gen(function* handle() {
      const input = yield* readRouteInput(subtaskStatusRoute, request, {
        id: params.taskId,
        subtaskId: params.subtaskId,
      });
      return yield* setTaskSubtaskStatus(
        request.headers,
        input.params.id,
        input.params.subtaskId,
        input.body,
        input.idempotencyKey
      );
    }).pipe(Effect.provide(AuthSessionLive), Effect.provide(IdempotencyLive))
  );
};
