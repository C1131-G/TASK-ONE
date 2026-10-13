"use server";

import { Effect, Schema } from "effect";

import { AuthSessionLive, AuthSession } from "@/src/server/auth/session";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  SessionManagement,
  SessionManagementLive,
} from "@/src/server/people/session-management";

// oxlint-disable-next-line eslint(func-style) -- Next requires exported Server Actions in this form.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function revokeSessionAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({ sessionId: Schema.String }),
    (validated) =>
      Effect.gen(function* revokeSession() {
        const requestHeaders = yield* requestHeadersOrFail;
        const session = yield* AuthSession;
        const user = yield* session.requireAuthenticated(requestHeaders);
        const management = yield* SessionManagement;
        yield* management.revokeSession(user.id, validated.sessionId);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(SessionManagementLive)
      ),
    undefined,
    Schema.Undefined
  );
  return result;
}
