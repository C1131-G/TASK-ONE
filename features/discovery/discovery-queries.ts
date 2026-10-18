import "server-only";
import { Effect, Schema } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import { WorkspaceSearchResultsSchema } from "@/src/server/preferences/discovery-contracts";
import {
  DiscoveryManagement,
  DiscoveryManagementLive,
  PersonalWorkspaceSchema,
} from "@/src/server/preferences/discovery-management";

export const getPersonalWorkspace = async (input: unknown) => {
  const result = await runServerAction(
    input,
    Schema.Struct({}),
    () =>
      Effect.gen(function* getPersonalWorkspaceProgram() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const discovery = yield* DiscoveryManagement;
        return yield* discovery.listPersonalWorkspace(user.id);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(DiscoveryManagementLive)
      ),
    undefined,
    PersonalWorkspaceSchema
  );
  return result;
};

export const getWorkspaceSearchResults = async (input: unknown) => {
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
      Effect.gen(function* searchWorkspaceProgram() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const discovery = yield* DiscoveryManagement;
        return yield* discovery.searchWorkspace(user.id, validated.query);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(DiscoveryManagementLive)
      ),
    undefined,
    WorkspaceSearchResultsSchema
  );
  return result;
};
