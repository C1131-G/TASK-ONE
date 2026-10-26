import { Effect } from "effect";

import { markPortalNotificationReadRoute } from "@/src/mobile-api/routes-notifications";
import { respondWith } from "@/src/server/api/http-response";
import { markPortalNotificationRead } from "@/src/server/api/notifications/portal";
import { readRouteInput } from "@/src/server/api/route-input";
import { AuthSessionLive } from "@/src/server/auth/session";

export const POST = (
  request: Request,
  context: { readonly params: Promise<Record<string, string>> }
): Promise<Response> =>
  respondWith(
    Effect.gen(function* markRead() {
      const input = yield* readRouteInput(
        markPortalNotificationReadRoute,
        request,
        yield* Effect.promise(() => context.params)
      );
      return yield* markPortalNotificationRead(request.headers, input);
    }).pipe(Effect.provide(AuthSessionLive))
  );
