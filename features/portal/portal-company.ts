import "server-only";
import { Effect, Exit } from "effect";
import { headers } from "next/headers";
import { cache } from "react";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";

export interface PortalCompany {
  readonly companyName: string;
  readonly userName: string;
}

// The signed-in client's company and name for the portal header and account
// page. Anyone else (or a failed lookup) gets null; portal data still checks
// access itself.
export const getPortalCompany = cache(
  async (): Promise<PortalCompany | null> => {
    const requestHeaders = await headers();
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* readPortalCompany() {
        const sessions = yield* AuthSession;
        return yield* sessions.requirePortalAccess(requestHeaders);
      }).pipe(Effect.provide(AuthSessionLive))
    );
    if (!Exit.isSuccess(exit)) {
      return null;
    }
    return {
      companyName: exit.value.clientCompanyName,
      userName: exit.value.name,
    };
  }
);
