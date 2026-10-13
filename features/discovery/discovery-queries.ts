import "server-only";
import { Effect, Schema } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
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
