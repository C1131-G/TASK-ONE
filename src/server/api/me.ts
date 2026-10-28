import { Effect } from "effect";

import { getMeRoute } from "../../mobile-api/routes-account";
import type { MobileMe } from "../../mobile-api/routes-account";
import { AuthSession, AuthSessionLive } from "../auth/session";
import type { AppError } from "../core/action-result";
import { readRouteInput } from "./route-input";

// Who the bearer token belongs to. The app reads this once after sign-in to
// choose between the workspace and the client portal. It goes through the same
// gate as every other route, so it is counted and logged like them.
export const getMe = (request: Request): Effect.Effect<MobileMe, AppError> =>
  Effect.gen(function* resolveMe() {
    yield* readRouteInput(getMeRoute, request);
    const session = yield* AuthSession;
    const user = yield* session.requireAuthenticated(request.headers);
    return {
      clientCompanyId: user.clientCompanyId,
      id: user.id,
      mustChangePassword: user.mustChangePassword,
      name: user.name,
      role: user.role,
      timeZone: user.timeZone,
    };
  }).pipe(Effect.provide(AuthSessionLive));
