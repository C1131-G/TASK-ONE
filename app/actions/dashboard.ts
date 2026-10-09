"use server";

import { Effect, Schema } from "effect";
import { headers } from "next/headers";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import { runServerAction } from "@/src/server/core/server-action";
import { Dashboard, DashboardLive } from "@/src/server/dashboard/service";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function getDashboardOverviewAction(input: unknown) {
  const result = await runServerAction(input, Schema.Struct({}), () =>
    Effect.gen(function* getDashboardOverview() {
      const requestHeaders = yield* Effect.tryPromise({
        catch: () =>
          new AppError({
            code: "UNAVAILABLE",
            message: "The request could not be completed.",
          }),
        try: () => headers(),
      });
      const sessions = yield* AuthSession;
      const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
      const dashboard = yield* Dashboard;
      return yield* dashboard.getOverview(user.id);
    }).pipe(Effect.provide(AuthSessionLive), Effect.provide(DashboardLive))
  );
  return result;
}
