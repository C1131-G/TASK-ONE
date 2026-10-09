"use server";

import { Effect, Schema } from "effect";
import { headers } from "next/headers";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
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
        const requestHeaders = yield* Effect.tryPromise({
          catch: () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            }),
          try: () => headers(),
        });
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
  return result;
}
