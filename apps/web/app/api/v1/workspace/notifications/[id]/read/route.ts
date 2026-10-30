import { Effect } from "effect";

import { markWorkspaceNotificationReadRoute } from "@/src/mobile-api/routes-notifications";
import { respondWith } from "@/src/server/api/http-response";
import { markWorkspaceNotificationRead } from "@/src/server/api/notifications/workspace";
import { readRouteInput } from "@/src/server/api/route-input";
import { AuthSessionLive } from "@/src/server/auth/session";

export const POST = (
  request: Request,
  context: { readonly params: Promise<Record<string, string>> }
): Promise<Response> =>
  respondWith(
    Effect.gen(function* markRead() {
      const input = yield* readRouteInput(
        markWorkspaceNotificationReadRoute,
        request,
        yield* Effect.promise(() => context.params)
      );
      return yield* markWorkspaceNotificationRead(request.headers, input);
    }).pipe(Effect.provide(AuthSessionLive))
  );
