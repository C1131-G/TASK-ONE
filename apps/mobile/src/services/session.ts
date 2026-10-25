import { Context, Effect, Layer, Schema, Stream, SubscriptionRef, type Duration } from "effect";

import { buildClient } from "@api/client";
import { mobileRoutes } from "@api/routes";
import type { MobileMe } from "@api/routes-account";

import { fromMobileApiError, type AppFailure } from "@/errors";
import type { LifecycleState } from "@/services/app-lifecycle";
import { TokenSource } from "@/services/mobile-api";
import { SecureStorage } from "@/services/secure-storage";

const TOKEN_KEY = "session-token";

const TokenCodec = Schema.String;

export type SessionState =
  | { readonly kind: "anonymous" }
  | { readonly kind: "authenticated"; readonly token: string; readonly me: MobileMe };

export interface SignInInput {
  readonly email: string;
  readonly password: string;
}

export class Session extends Context.Service<
  Session,
  {
    /** Emits every session change, starting with the current state. */
    readonly changes: Stream.Stream<SessionState>;
    readonly current: Effect.Effect<SessionState>;
    /** Exchanges credentials for a token, loads /me and persists the token. */
    readonly signIn: (input: SignInInput) => Effect.Effect<SessionState, AppFailure>;
    /** Restores the stored token, validating it against /me. */
    readonly restore: Effect.Effect<SessionState, never>;
    /** Revokes the server session and clears local state. */
    readonly signOut: Effect.Effect<void, never>;
    /** Clears local state without a server call (used on a 401 cascade). */
    readonly invalidate: Effect.Effect<void, never>;
    /**
     * Runs forever: signs a client-role session out after `idle` in the
     * background. Staff sessions are never timed out.
     */
    readonly watchClientIdle: (
      lifecycleChanges: Stream.Stream<LifecycleState>,
      idle: Parameters<typeof Effect.sleep>[0],
    ) => Effect.Effect<never>;
  }
>()("metsys/mobile/Session") {}

export interface SessionDeps {
  readonly baseUrl: string;
  readonly fetchImpl?: typeof fetch;
}

const ANONYMOUS: SessionState = { kind: "anonymous" };

type AuthenticatedSession = Extract<SessionState, { kind: "authenticated" }>;

const headValue = <A>(stream: Stream.Stream<A>): Effect.Effect<A, never> =>
  Effect.flatMap(Stream.runHead(stream), (head) =>
    head._tag === "Some" ? Effect.succeed(head.value) : Effect.never,
  );

export const makeSession = (deps: SessionDeps) =>
  Effect.gen(function* () {
    const storage = yield* Effect.service(SecureStorage);
    const ref = yield* SubscriptionRef.make<SessionState>(ANONYMOUS);

    const client = (token: string) =>
      buildClient(mobileRoutes, {
        baseUrl: deps.baseUrl,
        ...(deps.fetchImpl === undefined ? {} : { fetch: deps.fetchImpl }),
        token,
      });

    const persist = (token: string) =>
      Effect.catchEager(storage.write(TOKEN_KEY, token, TokenCodec), () => Effect.void);

    const clear = Effect.andThen(
      SubscriptionRef.set(ref, ANONYMOUS),
      Effect.catchEager(storage.remove(TOKEN_KEY), () => Effect.void),
    );

    const authenticated = (token: string, me: MobileMe): SessionState => ({
      kind: "authenticated",
      me,
      token,
    });

    const loadMe = (token: string) =>
      Effect.flatMap(
        Effect.tryPromise({
          catch: (error) => fromMobileApiError(error),
          try: () => client(token).getMe(),
        }),
        (me) =>
          Effect.as(SubscriptionRef.set(ref, authenticated(token, me)), authenticated(token, me)),
      );

    const revokeOnServer = (token: string) =>
      Effect.asVoid(
        Effect.catchEager(
          Effect.tryPromise({
            catch: () => new Error("sign-out failed"),
            try: () =>
              (deps.fetchImpl ?? fetch)(`${deps.baseUrl}/api/auth/sign-out`, {
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
              }),
          }),
          () => Effect.void,
        ),
      );

    const session = Session.of({
      changes: SubscriptionRef.changes(ref),
      current: SubscriptionRef.get(ref),
      invalidate: clear,
      restore: Effect.flatMap(
        Effect.catchEager(storage.read(TOKEN_KEY, TokenCodec), () => Effect.succeed(null)),
        (token) =>
          token === null || token.length === 0
            ? Effect.succeed(ANONYMOUS)
            : Effect.catchEager(loadMe(token), () =>
                Effect.as(
                  Effect.andThen(
                    SubscriptionRef.set(ref, ANONYMOUS),
                    Effect.catchEager(storage.remove(TOKEN_KEY), () => Effect.void),
                  ),
                  ANONYMOUS,
                ),
              ),
      ),
      signIn: (input) =>
        Effect.flatMap(
          Effect.tryPromise({
            catch: (error) => fromMobileApiError(error),
            try: async () => {
              const response = await (deps.fetchImpl ?? fetch)(
                `${deps.baseUrl}/api/auth/sign-in/email`,
                {
                  body: JSON.stringify({ email: input.email, password: input.password }),
                  headers: { "content-type": "application/json" },
                  method: "POST",
                },
              );
              return response.headers.get("set-auth-token") ?? "";
            },
          }),
          (token) =>
            token.length === 0
              ? Effect.fail(fromMobileApiError(new Error("sign-in rejected")))
              : Effect.flatMap(persist(token), () => loadMe(token)),
        ),
      signOut: Effect.flatMap(SubscriptionRef.get(ref), (state) =>
        state.kind === "authenticated"
          ? Effect.andThen(revokeOnServer(state.token), clear)
          : clear,
      ),
      watchClientIdle: (lifecycleChanges, idle) =>
        Effect.forever(
          Effect.gen(function* () {
            const state = yield* headValue(
              Stream.filter(
                SubscriptionRef.changes(ref),
                (candidate): candidate is AuthenticatedSession =>
                  candidate.kind === "authenticated" && candidate.me.role === "client",
              ),
            );
            yield* headValue(Stream.filter(lifecycleChanges, (change) => change === "background"));
            // Whoever completes first decides: the idle timeout signs the
            // client out, returning to the foreground just restarts the wait.
            yield* Effect.race(
              Effect.as(Effect.sleep(idle), "timeout" as const),
              Effect.as(headValue(Stream.filter(lifecycleChanges, (c) => c === "active")), "active" as const),
            ).pipe(
              Effect.flatMap((outcome) =>
                outcome === "timeout"
                  ? Effect.andThen(revokeOnServer(state.token), clear)
                  : Effect.void,
              ),
            );
          }),
        ),
    });

    return session;
  });

/** The live layer; the native SecureStorage import stays deferred. */
export const makeSessionLayer = (deps: SessionDeps): Layer.Layer<Session, never, SecureStorage> =>
  Layer.effect(Session, makeSession(deps));

/** Adapts the session into the TokenSource the MobileApi service consumes. */
export const TokenSourceFromSession: Layer.Layer<TokenSource, never, Session> = Layer.effect(
  TokenSource,
  Effect.map(Effect.service(Session), (session) =>
    TokenSource.of({
      currentToken: Effect.map(session.current, (state) =>
        state.kind === "authenticated" ? state.token : null,
      ),
      onUnauthenticated: session.invalidate,
    }),
  ),
);
