import { Effect } from "effect";

import { listPortalNotificationsRoute } from "@/src/mobile-api/routes-notifications";
import { respondWith } from "@/src/server/api/http-response";
import { listPortalInbox } from "@/src/server/api/notifications/portal";
import { readRouteInput } from "@/src/server/api/route-input";
import { AuthSessionLive } from "@/src/server/auth/session";

// Reading the request keeps this answer per request.
export const GET = (request: Request): Promise<Response> =>
  respondWith(
    Effect.gen(function* inbox() {
      const input = yield* readRouteInput(
        listPortalNotificationsRoute,
        request
      );
      return yield* listPortalInbox(request.headers, input);
    }).pipe(Effect.provide(AuthSessionLive))
  );
