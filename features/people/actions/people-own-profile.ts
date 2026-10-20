import "server-only";
import { Effect, Schema } from "effect";
import { refresh, revalidatePath } from "next/cache";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import { IdempotencyKeySchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import {
  ServerActionOutputSchema,
  runServerAction,
} from "@/src/server/core/server-action";
import {
  UpdateOwnProfileInputSchema,
  UserManagement,
  UserManagementLive,
} from "@/src/server/people/user-management";

import { OwnProfileResultSchema } from "./people-own-profile-schema";

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
        const requestHeaders = yield* requestHeadersOrFail;
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
    refresh();
  }
  return action;
}
