import { Effect } from "effect";

import { listWorkspaceNotificationsRoute } from "@/src/mobile-api/routes-notifications";
import { respondWith } from "@/src/server/api/http-response";
import { listWorkspaceInbox } from "@/src/server/api/notifications/workspace";
import { readRouteInput } from "@/src/server/api/route-input";
import { AuthSessionLive } from "@/src/server/auth/session";

// Reading the request keeps this answer per request.
export const GET = (request: Request): Promise<Response> =>
  respondWith(
    Effect.gen(function* inbox() {
      const input = yield* readRouteInput(
        listWorkspaceNotificationsRoute,
        request
      );
      return yield* listWorkspaceInbox(request.headers, input);
    }).pipe(Effect.provide(AuthSessionLive))
  );
