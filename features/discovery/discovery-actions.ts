"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import {
  ServerActionOutputSchema,
  runServerAction,
} from "@/src/server/core/server-action";
import {
  DiscoveryManagement,
  DiscoveryManagementLive,
  WorkspaceSearchResultsSchema,
} from "@/src/server/preferences/discovery-management";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function toggleProjectFavoriteAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      projectId: UUIDSchema,
    }),
    (validated) =>
      Effect.gen(function* toggleFavorite() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const discovery = yield* DiscoveryManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            discovery.toggleProjectFavorite(user.id, validated.projectId),
          input: { projectId: validated.projectId },
          key: validated.idempotencyKey,
          operation: "projectFavorite.toggle",
          resultSchema: Schema.Boolean,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(DiscoveryManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ServerActionOutputSchema
  );
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/projects");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function toggleTaskFavoriteAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      idempotencyKey: IdempotencyKeySchema,
      taskId: UUIDSchema,
    }),
    (validated) =>
      Effect.gen(function* toggleFavorite() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const discovery = yield* DiscoveryManagement;
        const idempotency = yield* Idempotency;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () =>
            discovery.toggleTaskFavorite(user.id, validated.taskId),
          input: { taskId: validated.taskId },
          key: validated.idempotencyKey,
          operation: "taskFavorite.toggle",
          resultSchema: Schema.Boolean,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(DiscoveryManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ServerActionOutputSchema
  );
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/tasks");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function searchWorkspaceAction(input: unknown) {
  const result = await runServerAction(
    input,
    Schema.Struct({
      query: Schema.String.check(
        Schema.makeFilter((query) =>
          query.length <= 120
            ? undefined
            : "Search text is limited to 120 characters."
        )
      ),
    }),
    (validated) =>
      Effect.gen(function* searchWorkspace() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const discovery = yield* DiscoveryManagement;
        const results = yield* discovery.searchWorkspace(
          user.id,
          validated.query
        );
        return results;
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(DiscoveryManagementLive)
      ),
    undefined,
    WorkspaceSearchResultsSchema
  );
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function recordRecentSearchAction(input: unknown) {
  return await runServerAction(
    input,
    Schema.Struct({
      query: Schema.String.check(
        Schema.makeFilter((query) =>
          query.length <= 120
            ? undefined
            : "Search text is limited to 120 characters."
        )
      ),
    }),
    (validated) =>
      Effect.gen(function* recordRecentSearch() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        if (validated.query.trim()) {
          const discovery = yield* DiscoveryManagement;
          yield* discovery.addRecentSearch(user.id, validated.query);
        }
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(DiscoveryManagementLive)
      ),
    undefined,
    Schema.Void
  );
}
