"use server";

import { Effect, Schema } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import { IdempotencyKeySchema } from "@/src/server/core/input-schemas";
import { runServerAction } from "@/src/server/core/server-action";
import {
  PersonalPreferenceSchema,
  PersonalPreferences,
  PersonalPreferencesLive,
} from "@/src/server/preferences/personal-preferences";

const getRequestHeaders = () =>
  Effect.tryPromise({
    catch: () =>
      new AppError({
        code: "UNAVAILABLE",
        message: "The request could not be completed.",
      }),
    try: async () => {
      const nextHeaders = await import("next/headers");
      return nextHeaders.headers();
    },
  });

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function getPersonalPreferencesAction(input: unknown) {
  return await runServerAction(
    input,
    Schema.Struct({}),
    () =>
      Effect.gen(function* getPreferences() {
        const requestHeaders = yield* getRequestHeaders();
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const preferences = yield* PersonalPreferences;
        return yield* preferences.get(user.id);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(PersonalPreferencesLive)
      ),
    undefined,
    PersonalPreferenceSchema
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function savePersonalPreferencesAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      preferences: PersonalPreferenceSchema,
    }),
    (validated) =>
      Effect.gen(function* savePreferences() {
        const requestHeaders = yield* getRequestHeaders();
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const preferences = yield* PersonalPreferences;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => preferences.save(user.id, validated.preferences),
          input: validated.preferences,
          key: validated.idempotencyKey,
          operation: "preferences.save",
          resultSchema: PersonalPreferenceSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(PersonalPreferencesLive),
        Effect.provide(IdempotencyLive)
      )
  );
  return result;
}
