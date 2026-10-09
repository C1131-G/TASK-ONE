import { Effect } from "effect";

import { AuthSession } from "../auth/session";
import { AppError } from "./action-result";

export const requireAdmin = (headers: Headers) =>
  Effect.gen(function* checkAdminAccess() {
    const session = yield* AuthSession;
    const user = yield* session.requireWorkspaceAccess(headers);
    if (user.role !== "admin") {
      return yield* Effect.fail(
        new AppError({
          code: "FORBIDDEN",
          message: "Administrator access is required.",
        })
      );
    }
    return user;
  });
