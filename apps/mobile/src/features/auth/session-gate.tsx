import { Effect, Stream } from "effect";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { AppLifecycle } from "@/services/app-lifecycle";
import { MobileApi } from "@/services/mobile-api";
import { ApiContext, KeysContext } from "@/runtime/api-hooks";
import { IdempotencyKeys } from "@/services/idempotency-keys";
import { Session, type SessionService, type SessionState } from "@/services/session";
import { appRuntime } from "@/runtime/runtime";

export interface SessionGateValue {
  readonly restored: boolean;
  readonly state: SessionState;
}

const initialGateValue: SessionGateValue = {
  restored: false,
  state: { kind: "anonymous" },
};

export const SessionStateContext = createContext<SessionGateValue>(initialGateValue);

export const useSessionState = (): SessionGateValue => useContext(SessionStateContext);

export const SessionGateContext = createContext<SessionService | null>(null);

/**
 * Restores the session once, forks the client idle watch, mirrors the
 * session state for the group layouts and exposes the session to screens.
 */
export const SessionGate = ({ children }: { children: ReactNode }) => {
  const [value, setValue] = useState<SessionGateValue>(initialGateValue);
  const [session, setSession] = useState<SessionService | null>(null);
  const [api, setApi] = useState<MobileApi["Service"] | null>(null);
  const [keys, setKeys] = useState<IdempotencyKeys["Service"] | null>(null);

  useEffect(() => {
    const runtime = appRuntime();
    const setup = Effect.gen(function* () {
      const api = yield* Effect.service(MobileApi);
      const keys = yield* Effect.service(IdempotencyKeys);
      const lifecycle = yield* Effect.service(AppLifecycle);
      const sessionService = yield* Effect.service(Session);
      return { api, keys, lifecycle, sessionService };
    });

    void runtime.runPromise(
      Effect.gen(function* () {
        const { api, keys, lifecycle, sessionService } = yield* setup;
        yield* Effect.sync(() => setSession(sessionService));
        yield* Effect.sync(() => setApi(api));
        yield* Effect.sync(() => setKeys(keys));
        runtime.runFork(
          Stream.runDrain(
            Stream.tap(sessionService.changes, (state) =>
              Effect.sync(() => setValue({ restored: true, state })),
            ),
          ),
        );
        runtime.runFork(sessionService.watchClientIdle(lifecycle.changes, "2 hours"));
        runtime.runFork(sessionService.restore);
      }),
    );
  }, []);

  return (
    <SessionStateContext.Provider value={value}>
      <SessionGateContext.Provider value={session}>
        <ApiContext.Provider value={api}>
          <KeysContext.Provider value={keys}>{children}</KeysContext.Provider>
        </ApiContext.Provider>
      </SessionGateContext.Provider>
    </SessionStateContext.Provider>
  );
};

/** The session for screens; only valid inside the gate. */
export const useGateSession = (): SessionService | null => useContext(SessionGateContext);
