"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import { IdempotencyKeySchema } from "@/src/server/core/input-schemas";
import {
  ServerActionOutputSchema,
  runServerAction,
} from "@/src/server/core/server-action";
import {
  UpdateOwnProfileInputSchema,
  UserManagement,
  UserManagementLive,
} from "@/src/server/people/user-management";

import { OwnProfileResultSchema } from "./employees-shared";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function updateOwnProfileAction(input: unknown) {
  const action = await runServerAction(
    input,
    Schema.Struct({
      ...UpdateOwnProfileInputSchema.fields,
      idempotencyKey: IdempotencyKeySchema,
    }),
    (validated) =>
      Effect.gen(function* updateOwnProfile() {
        const requestHeaders = yield* Effect.tryPromise({
          catch: () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            }),
          try: () => headers(),
        });
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const management = yield* UserManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...profileInput } = validated;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () => management.updateOwnProfile(actor.id, profileInput),
          input: profileInput,
          key: idempotencyKey,
          operation: "profile.update",
          resultSchema: OwnProfileResultSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(UserManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ServerActionOutputSchema
  );
  if (action.ok) {
    revalidatePath("/settings/profile");
  }
  return action;
}
