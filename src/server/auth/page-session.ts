import "server-only";
import { Cause, Effect, Exit } from "effect";
import { headers } from "next/headers";
import { cache } from "react";

import { AppError } from "../core/action-result";
import { AuthSession, AuthSessionLive } from "./session";
import type { AuthenticatedUser } from "./session-types";

export type PageSession =
  // `reason` is set when the visitor was signed out rather than never in.
  | { readonly kind: "anonymous"; readonly reason?: "inactivity" }
  | { readonly kind: "authenticated"; readonly user: AuthenticatedUser };

// The workspace gate, shell and page sections all ask for the session; one
// request resolves it once.
export const getPageSession = cache(async (): Promise<PageSession> => {
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
    const { details } = failure.value;
    const inactive =
      typeof details === "object" &&
      details !== null &&
      "reason" in details &&
      details.reason === "inactivity";
    return inactive
      ? { kind: "anonymous", reason: "inactivity" }
      : { kind: "anonymous" };
  }

  throw failure._tag === "Some"
    ? failure.value
    : new Error("The authentication service is unavailable.");
});
