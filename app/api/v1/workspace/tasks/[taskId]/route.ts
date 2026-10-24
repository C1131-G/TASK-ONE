import { Effect } from "effect";

import { taskContextRoute } from "@/src/mobile-api/routes-tasks";
import { respondWith } from "@/src/server/api/http-response";
import { readRouteInput } from "@/src/server/api/route-input";
import { readTaskContext } from "@/src/server/api/tasks/task-context";
import { AuthSessionLive } from "@/src/server/auth/session";

export const GET = async (
  request: Request,
  context: { params: Promise<{ taskId: string }> }
): Promise<Response> => {
  const params = await context.params;
  return respondWith(
    Effect.gen(function* handle() {
      const input = yield* readRouteInput(taskContextRoute, request, params);
      return yield* readTaskContext(request.headers, input.params.taskId);
    }).pipe(Effect.provide(AuthSessionLive))
  );
};
