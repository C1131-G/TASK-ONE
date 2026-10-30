import { Effect } from "effect";

import { myWorkRoute } from "@/src/mobile-api/routes-tasks";
import { respondWith } from "@/src/server/api/http-response";
import { readRouteInput } from "@/src/server/api/route-input";
import { getMyWork } from "@/src/server/api/tasks/my-work";
import { AuthSessionLive } from "@/src/server/auth/session";

export const GET = (request: Request): Promise<Response> =>
  respondWith(
    Effect.gen(function* handle() {
      const { query } = yield* readRouteInput(myWorkRoute, request);
      return yield* getMyWork(request.headers, query);
    }).pipe(Effect.provide(AuthSessionLive))
  );
