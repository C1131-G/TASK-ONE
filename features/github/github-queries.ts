import "server-only";
import { Effect, Schema } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { requireAdmin } from "@/src/server/core/admin-action";
import { UUIDSchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  GithubConnections,
  GithubConnectionsLive,
} from "@/src/server/github/github-connections";
import {
  GithubConnectionListSchema,
  LinkedPullListSchema,
} from "@/src/server/github/github-contracts";
import { GithubPulls, GithubPullsLive } from "@/src/server/github/github-pulls";

export const listGithubConnections = async (input: unknown = {}) =>
  await runServerAction(
    input,
    Schema.Struct({}),
    () =>
      Effect.gen(function* listConnections() {
        const administrator = yield* requireAdmin(yield* requestHeadersOrFail);
        const connections = yield* GithubConnections;
        return yield* connections.list(administrator.id);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(GithubConnectionsLive)
      ),
    undefined,
    GithubConnectionListSchema
  );

// Staff only: clients never see the pull requests behind their tasks.
export const getTaskLinkedPulls = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({ taskId: UUIDSchema }),
    ({ taskId }) =>
      Effect.gen(function* linkedPulls() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const pulls = yield* GithubPulls;
        return yield* pulls.forTask(actor.id, taskId);
      }).pipe(Effect.provide(AuthSessionLive), Effect.provide(GithubPullsLive)),
    undefined,
    LinkedPullListSchema
  );
