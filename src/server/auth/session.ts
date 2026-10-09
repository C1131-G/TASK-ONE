import { Context, Effect, Layer } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { auth } from "./auth";

export interface AuthenticatedUser {
  readonly id: string;
  readonly role: "admin" | "employee";
  readonly employeeNumber: number;
  readonly mustChangePassword: boolean;
  readonly timeZone: string | null;
}

export class AuthSession extends Context.Service<
  AuthSession,
  {
    readonly requireAuthenticated: (
      headers: Headers
    ) => Effect.Effect<AuthenticatedUser, AppError>;
    readonly requireWorkspaceAccess: (
      headers: Headers
    ) => Effect.Effect<AuthenticatedUser, AppError>;
  }
>()("metsys/server/AuthSession") {}

const notAuthenticated = () =>
  new AppError({
    code: "UNAUTHENTICATED",
    message: "Sign in to continue.",
  });

const unavailable = () =>
  new AppError({
    code: "UNAVAILABLE",
    message: "The authentication service is unavailable.",
  });

const loadSessionUser = (
  headers: Headers
): Effect.Effect<AuthenticatedUser, AppError> =>
  Effect.gen(function* resolveSessionUser() {
    const session = yield* Effect.tryPromise({
      catch: unavailable,
      try: () => auth.api.getSession({ headers }),
    });

    if (!session) {
      return yield* Effect.fail(notAuthenticated());
    }

    const user = yield* Effect.tryPromise({
      catch: unavailable,
      try: () =>
        db.orm.public.User.where({ id: session.user.id })
          .select(
            "role",
            "employeeNumber",
            "mustChangePassword",
            "deactivatedAt",
            "timeZone"
          )
          .first(),
    });

    if (!user || user.deactivatedAt) {
      return yield* Effect.fail(notAuthenticated());
    }

    if (user.role !== "admin" && user.role !== "employee") {
      return yield* Effect.fail(unavailable());
    }

    return {
      employeeNumber: user.employeeNumber,
      id: session.user.id,
      mustChangePassword: user.mustChangePassword,
      role: user.role,
      timeZone: user.timeZone,
    };
  });

export const AuthSessionLive = Layer.succeed(
  AuthSession,
  AuthSession.of({
    requireAuthenticated: loadSessionUser,
    requireWorkspaceAccess: (headers) =>
      loadSessionUser(headers).pipe(
        Effect.flatMap((user) =>
          user.mustChangePassword
            ? Effect.fail(
                new AppError({
                  code: "FORBIDDEN",
                  message: "Change your password before continuing.",
                })
              )
            : Effect.succeed(user)
        )
      ),
  })
);
