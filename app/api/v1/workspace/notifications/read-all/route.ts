import { Effect } from "effect";

import { markAllWorkspaceNotificationsReadRoute } from "@/src/mobile-api/routes-notifications";
import { respondWith } from "@/src/server/api/http-response";
import { markAllWorkspaceNotificationsRead } from "@/src/server/api/notifications/workspace";
import { readRouteInput } from "@/src/server/api/route-input";
import { AuthSessionLive } from "@/src/server/auth/session";

export const POST = (request: Request): Promise<Response> =>
  respondWith(
    Effect.gen(function* markAllRead() {
      const input = yield* readRouteInput(
        markAllWorkspaceNotificationsReadRoute,
        request
      );
      return yield* markAllWorkspaceNotificationsRead(request.headers, input);
    }).pipe(Effect.provide(AuthSessionLive))
  );
