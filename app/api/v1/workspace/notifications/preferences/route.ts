import { Effect } from "effect";

import {
  getWorkspaceNotificationPreferencesRoute,
  setWorkspaceNotificationPreferenceRoute,
} from "@/src/mobile-api/routes-notifications";
import { respondWith } from "@/src/server/api/http-response";
import {
  readWorkspacePreferences,
  writeWorkspacePreference,
} from "@/src/server/api/notifications/workspace";
import { readRouteInput } from "@/src/server/api/route-input";
import { AuthSessionLive } from "@/src/server/auth/session";

// Reading the request keeps this answer per request.
export const GET = (request: Request): Promise<Response> =>
  respondWith(
    Effect.gen(function* preferences() {
      yield* readRouteInput(getWorkspaceNotificationPreferencesRoute, request);
      return yield* readWorkspacePreferences(request.headers);
    }).pipe(Effect.provide(AuthSessionLive))
  );

export const PATCH = (request: Request): Promise<Response> =>
  respondWith(
    Effect.gen(function* setPreference() {
      const input = yield* readRouteInput(
        setWorkspaceNotificationPreferenceRoute,
        request
      );
      return yield* writeWorkspacePreference(request.headers, input);
    }).pipe(Effect.provide(AuthSessionLive))
  );
