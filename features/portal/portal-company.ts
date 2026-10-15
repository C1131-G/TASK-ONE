import "server-only";
import { Effect, Exit, Layer } from "effect";
import { headers } from "next/headers";
import { cache } from "react";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { ClientLogosLive } from "@/src/server/clients/client-logo";
import { ClientLogos } from "@/src/server/clients/client-logo-contracts";
import { StorageLive } from "@/src/server/storage/storage";

export interface PortalCompany {
  readonly companyName: string;
  // A short-lived signed URL for the company logo, or null without one.
  readonly logoUrl: string | null;
  readonly userName: string;
  // Set while an admin previews this client: the admin's name and the
  // previewed account's id (for the exit link).
  readonly preview: {
    readonly adminName: string;
    readonly userId: string;
  } | null;
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
        const user = yield* sessions.requirePortalView(requestHeaders);
        const logos = yield* ClientLogos;
        // While previewing, the viewer is the previewed client, so the logo
        // shown is always that client's own company's.
        const logoUrl = yield* logos
          .signedLogo(user.id, user.clientCompanyId)
          .pipe(Effect.orElseSucceed(() => null));
        return { logoUrl, user };
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(Layer.provide(ClientLogosLive, StorageLive))
      )
    );
    if (!Exit.isSuccess(exit)) {
      return null;
    }
    const { logoUrl, user } = exit.value;
    return {
      companyName: user.clientCompanyName,
      logoUrl,
      preview: user.preview
        ? { adminName: user.preview.adminName, userId: user.id }
        : null,
      userName: user.name,
    };
  }
);
