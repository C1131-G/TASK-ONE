import { Effect } from "effect";

import { markAllPortalNotificationsReadRoute } from "@/src/mobile-api/routes-notifications";
import { respondWith } from "@/src/server/api/http-response";
import { markAllPortalNotificationsRead } from "@/src/server/api/notifications/portal";
import { readRouteInput } from "@/src/server/api/route-input";
import { AuthSessionLive } from "@/src/server/auth/session";

export const POST = (request: Request): Promise<Response> =>
  respondWith(
    Effect.gen(function* markAllRead() {
      const input = yield* readRouteInput(
        markAllPortalNotificationsReadRoute,
        request
      );
      return yield* markAllPortalNotificationsRead(request.headers, input);
    }).pipe(Effect.provide(AuthSessionLive))
  );
