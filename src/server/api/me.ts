import { Effect, Schema } from "effect";

import { AuthSession } from "../auth/session";
import type { AppError } from "../core/action-result";

export const MeSchema = Schema.Struct({
  clientCompanyId: Schema.NullOr(Schema.String),
  id: Schema.String,
  mustChangePassword: Schema.Boolean,
  name: Schema.String,
  role: Schema.Literals(["admin", "employee", "client"]),
  timeZone: Schema.NullOr(Schema.String),
});

export type MobileMe = typeof MeSchema.Type;

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
