import { Effect } from "effect";

import {
  getPortalNotificationPreferencesRoute,
  setPortalNotificationPreferenceRoute,
} from "@/src/mobile-api/routes-notifications";
import { respondWith } from "@/src/server/api/http-response";
import {
  readPortalPreferences,
  writePortalPreference,
} from "@/src/server/api/notifications/portal";
import { readRouteInput } from "@/src/server/api/route-input";
import { AuthSessionLive } from "@/src/server/auth/session";

// Reading the request keeps this answer per request.
export const GET = (request: Request): Promise<Response> =>
  respondWith(
    Effect.gen(function* preferences() {
      yield* readRouteInput(getPortalNotificationPreferencesRoute, request);
      return yield* readPortalPreferences(request.headers);
    }).pipe(Effect.provide(AuthSessionLive))
  );

export const PATCH = (request: Request): Promise<Response> =>
  respondWith(
    Effect.gen(function* setPreference() {
      const input = yield* readRouteInput(
        setPortalNotificationPreferenceRoute,
        request
      );
      return yield* writePortalPreference(request.headers, input);
    }).pipe(Effect.provide(AuthSessionLive))
  );
