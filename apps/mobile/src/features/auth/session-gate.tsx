import { Effect, Stream } from "effect";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { AppLifecycle } from "@/services/app-lifecycle";
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

  useEffect(() => {
    const runtime = appRuntime();
    const setup = Effect.gen(function* () {
      const sessionService = yield* Effect.service(Session);
      const lifecycle = yield* Effect.service(AppLifecycle);
      return { lifecycle, sessionService };
    });

    void runtime.runPromise(
      Effect.gen(function* () {
        const { lifecycle, sessionService } = yield* setup;
        yield* Effect.sync(() => setSession(sessionService));
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
      <SessionGateContext.Provider value={session}>{children}</SessionGateContext.Provider>
    </SessionStateContext.Provider>
  );
};

/** The session for screens; only valid inside the gate. */
export const useGateSession = (): SessionService | null => useContext(SessionGateContext);
