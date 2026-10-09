import "server-only";
import { Cause, Effect, Exit } from "effect";
import { headers } from "next/headers";

import { AppError } from "../core/action-result";
import { AuthSession, AuthSessionLive } from "./session";
import type { AuthenticatedUser } from "./session";

export type PageSession =
  | { readonly kind: "anonymous" }
  | { readonly kind: "authenticated"; readonly user: AuthenticatedUser };

export const getPageSession = async (): Promise<PageSession> => {
  const requestHeaders = await headers();
  const exit = await Effect.runPromiseExit(
    Effect.gen(function* readPageSession() {
      const sessions = yield* AuthSession;
      return yield* sessions.requireAuthenticated(requestHeaders);
    }).pipe(Effect.provide(AuthSessionLive))
  );

  if (Exit.isSuccess(exit)) {
    return { kind: "authenticated", user: exit.value };
  }

  const failure = Cause.findErrorOption(exit.cause);
  if (
    failure._tag === "Some" &&
    failure.value instanceof AppError &&
    failure.value.code === "UNAUTHENTICATED"
  ) {
    return { kind: "anonymous" };
  }

  throw failure._tag === "Some"
    ? failure.value
    : new Error("The authentication service is unavailable.");
};
