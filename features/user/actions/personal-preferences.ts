"use server";

import { Effect, Schema } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import { IdempotencyKeySchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import {
  ServerActionOutputSchema,
  runServerAction,
} from "@/src/server/core/server-action";
import {
  PersonalPreferenceSchema,
  PersonalPreferences,
  PersonalPreferencesLive,
  TaskTableColumnWidthsSchema,
} from "@/src/server/preferences/personal-preferences";

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
        const requestHeaders = yield* requestHeadersOrFail;
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
      ),
    undefined,
    ServerActionOutputSchema
  );
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function saveTaskTableColumnWidthsAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      columnWidths: TaskTableColumnWidthsSchema,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (validated) =>
      Effect.gen(function* saveColumnWidths() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const preferences = yield* PersonalPreferences;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            preferences.saveColumnWidths(user.id, validated.columnWidths),
          input: validated.columnWidths,
          key: validated.idempotencyKey,
          operation: "preferences.columnWidths.save",
          resultSchema: PersonalPreferenceSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(PersonalPreferencesLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ServerActionOutputSchema
  );
  return result;
}
