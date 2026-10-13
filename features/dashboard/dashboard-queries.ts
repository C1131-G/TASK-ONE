import "server-only";
import { Effect, Schema } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  Dashboard,
  DashboardLive,
  DashboardOverviewSchema,
} from "@/src/server/dashboard/service";

export const getDashboardOverview = async (input: unknown) => {
  const result = await runServerAction(
    input,
    Schema.Struct({}),
    () =>
      Effect.gen(function* getDashboardOverviewProgram() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const dashboard = yield* Dashboard;
        return yield* dashboard.getOverview(user.id);
      }).pipe(Effect.provide(AuthSessionLive), Effect.provide(DashboardLive)),
    undefined,
    DashboardOverviewSchema
  );
  return result;
};
