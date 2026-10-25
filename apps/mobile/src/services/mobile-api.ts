import { Context, Effect, Layer } from "effect";

import { buildClient, type MobileClient } from "@api/client";
import { clientRoutes } from "@/api/routes-for-client";

import { fromMobileApiError, Unauthenticated, type AppFailure } from "@/errors";

/**
 * The session-dependent inputs the API needs. The Session service provides
 * this in the live app; tests provide a stub.
 */
export class TokenSource extends Context.Service<
  TokenSource,
  {
    /** The bearer token for the signed-in session, or null when signed out. */
    readonly currentToken: Effect.Effect<string | null>;
    /** Reacts to a 401 by clearing the session. */
    readonly onUnauthenticated: Effect.Effect<void>;
  }
>()("metsys/mobile/TokenSource") {}

export interface MobileApiDeps {
  /** The app origin, without a trailing slash. */
  readonly baseUrl: string;
  /** Replaces global fetch; the mock layer injects its router here. */
  readonly fetchImpl?: typeof fetch;
}

export class MobileApi extends Context.Service<
  MobileApi,
  {
    /**
     * Runs one operation of the typed shared client. The token is read from
     * the session per call; a missing token fails with Unauthenticated
     * before any request, and a 401 clears the session.
     */
    readonly call: <A>(run: (client: MobileClient) => Promise<A>) => Effect.Effect<A, AppFailure>;
  }
>()("metsys/mobile/MobileApi") {}

export const makeMobileApi = (deps: MobileApiDeps) =>
  Effect.map(Effect.service(TokenSource), (tokens) =>
    MobileApi.of({
      call: (run) =>
        Effect.flatMap(tokens.currentToken, (token) => {
          if (token === null) {
            return Effect.fail(new Unauthenticated());
          }
          const client = buildClient(clientRoutes, {
            baseUrl: deps.baseUrl,
            ...(deps.fetchImpl === undefined ? {} : { fetch: deps.fetchImpl }),
            token,
          });
          return Effect.tryPromise({
            catch: (error) => fromMobileApiError(error),
            try: () => run(client),
          }).pipe(
            Effect.tapError((failure) =>
              failure._tag === "Unauthenticated" ? tokens.onUnauthenticated : Effect.void,
            ),
          );
        }),
    }));

/** Builds the MobileApi layer over a base URL and optional fetch replacement. */
export const makeMobileApiLayer = (
  deps: MobileApiDeps,
): Layer.Layer<MobileApi, never, TokenSource> => Layer.effect(MobileApi, makeMobileApi(deps));
