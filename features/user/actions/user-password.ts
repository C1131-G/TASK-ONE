import "server-only";
import { Effect, Schema } from "effect";
import { refresh } from "next/cache";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  PasswordManagement,
  PasswordManagementLive,
} from "@/src/server/people/password-management";

const ChangePasswordInputSchema = Schema.Struct({
  currentPassword: Schema.String,
  newPassword: Schema.String,
});

// oxlint-disable-next-line eslint(func-style) -- Next requires exported Server Actions in this form.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function changeOwnPasswordAction(input: unknown) {
  const result = await runServerAction(
    input,
    ChangePasswordInputSchema,
    (validated) =>
      Effect.gen(function* changeOwnPassword() {
        const requestHeaders = yield* requestHeadersOrFail;
        const session = yield* AuthSession;
        yield* session.requireAuthenticated(requestHeaders);
        const passwords = yield* PasswordManagement;
        yield* passwords.changeOwnPassword(
          requestHeaders,
          validated.currentPassword,
          validated.newPassword
        );
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(PasswordManagementLive)
      ),
    undefined,
    Schema.Undefined
  );
  if (result.ok) {
    refresh();
  }
  return result;
}
