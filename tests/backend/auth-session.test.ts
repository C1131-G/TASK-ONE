import { expect, it } from "bun:test";

import { Effect } from "effect";

import { AuthSession, AuthSessionLive } from "../../src/server/auth/session";
import { runEffectResult } from "../../src/server/core/action-result";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

it("rejects requests that have no authenticated session", async () => {
  const program = Effect.gen(function* program() {
    const session = yield* AuthSession;
    return yield* session.requireWorkspaceAccess(new Headers());
  });

  expect(
    await runEffectResult(
      Effect.provide(program, AuthSessionLive),
      "req-auth-session-anonymous"
    )
  ).toEqual({
    error: {
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
      reason: "session_ended",
      requestId: "req-auth-session-anonymous",
    },
    ok: false,
  });
});

// Client sessions themselves (company resolution, workspace refusal) are
// covered with real accounts in client-access.test.ts.
it("rejects portal requests that have no authenticated session", async () => {
  const program = Effect.gen(function* program() {
    const session = yield* AuthSession;
    return yield* session.requirePortalAccess(new Headers());
  });

  expect(
    await runEffectResult(
      Effect.provide(program, AuthSessionLive),
      "req-auth-session-portal-anonymous"
    )
  ).toMatchObject({ error: { code: "UNAUTHENTICATED" }, ok: false });
});
