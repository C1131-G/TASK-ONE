import { Effect } from "effect";

import { AuthSession } from "../auth/session";
import type { UserRole } from "../auth/session-types";
import type { AppError } from "../core/action-result";

export interface MobileMe {
  readonly id: string;
  readonly name: string;
  readonly role: UserRole;
  readonly clientCompanyId: string | null;
  readonly mustChangePassword: boolean;
  readonly timeZone: string | null;
}

// Who the bearer token belongs to. The app reads this once after sign-in to
// choose between the workspace and the client portal.
export const getMe = (
  headers: Headers
): Effect.Effect<MobileMe, AppError, AuthSession> =>
  Effect.gen(function* resolveMe() {
    const session = yield* AuthSession;
    const user = yield* session.requireAuthenticated(headers);
    return {
      clientCompanyId: user.clientCompanyId,
      id: user.id,
      mustChangePassword: user.mustChangePassword,
      name: user.name,
      role: user.role,
      timeZone: user.timeZone,
    };
  });
