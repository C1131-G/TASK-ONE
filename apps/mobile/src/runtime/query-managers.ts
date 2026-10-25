import { Effect, Stream } from "effect";
import { focusManager, onlineManager } from "@tanstack/react-query";

import type { AppLifecycleService } from "@/services/app-lifecycle";
import type { ConnectivityService } from "@/services/connectivity";

export interface QueryManagerWiring {
  readonly connectivity: ConnectivityService;
  readonly lifecycle: AppLifecycleService;
  /** Overrides for tests; defaults to the TanStack singletons. */
  readonly setFocused?: (focused: boolean) => void;
  readonly setOnline?: (online: boolean) => void;
}

/**
 * Runs forever, feeding the connectivity and lifecycle streams into
 * TanStack Query's managers. Callers fork it: the app forks it onto its
 * runtime at startup, and both drains never complete, so the race keeps
 * them running side by side.
 */
export const queryManagerWiring = (wiring: QueryManagerWiring): Effect.Effect<void> =>
  Effect.race(
    wiring.connectivity.changes.pipe(
      Stream.tap((online) =>
        Effect.sync(() => (wiring.setOnline ?? onlineManager.setOnline)(online)),
      ),
      Stream.runDrain,
    ),
    wiring.lifecycle.changes.pipe(
      Stream.tap((state) =>
        Effect.sync(() => (wiring.setFocused ?? focusManager.setFocused)(state === "active")),
      ),
      Stream.runDrain,
    ),
  ).pipe(Effect.asVoid);
