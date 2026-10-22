"use server";

import { Effect, Schema } from "effect";
import { refresh, revalidatePath } from "next/cache";

import { AuthSessionLive } from "@/src/server/auth/session";
import { requireAdmin } from "@/src/server/core/admin-action";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  GithubConnections,
  GithubConnectionsLive,
} from "@/src/server/github/github-connections";
import {
  GithubConnectionChangesSchema,
  GithubConnectionCreatedSchema,
  GithubConnectionInputSchema,
  GithubConnectionSummarySchema,
  GithubSecretSchema,
} from "@/src/server/github/github-contracts";

const refreshGithub = () => {
  revalidatePath("/settings/github");
  refresh();
};

// Not replayed through the idempotency store: it would keep the one-time
// secret. The form disables its button while the request runs.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function createGithubConnectionAction(input: unknown) {
  const result = await runServerAction(
    input,
    GithubConnectionInputSchema,
    (validated) =>
      Effect.gen(function* createConnection() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const connections = yield* GithubConnections;
        return yield* connections.create(administrator.id, validated);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(GithubConnectionsLive)
      ),
    undefined,
    GithubConnectionCreatedSchema
  );
  if (result.ok) {
    refreshGithub();
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function updateGithubConnectionAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      ...GithubConnectionChangesSchema.fields,
      connectionId: UUIDSchema,
      idempotencyKey: IdempotencyKeySchema,
    }),
    ({ connectionId, idempotencyKey, ...changes }) =>
      Effect.gen(function* updateConnection() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const connections = yield* GithubConnections;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            connections.update(administrator.id, connectionId, changes),
          input: { connectionId, ...changes },
          key: idempotencyKey,
          operation: "github.update",
          resultSchema: GithubConnectionSummarySchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(GithubConnectionsLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    GithubConnectionSummarySchema
  );
  if (result.ok) {
    refreshGithub();
  }
  return result;
}

// Not replayed: the response carries the new one-time secret.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function rotateGithubSecretAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({ connectionId: UUIDSchema }),
    ({ connectionId }) =>
      Effect.gen(function* rotateSecret() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const connections = yield* GithubConnections;
        return yield* connections.rotateSecret(administrator.id, connectionId);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(GithubConnectionsLive)
      ),
    undefined,
    GithubSecretSchema
  );
  if (result.ok) {
    refreshGithub();
  }
  return result;
}
