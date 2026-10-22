import {
  initialRealtimeState,
  realtimeReducer,
  shouldPoll,
} from "./realtime-state";
import type { RealtimeAction, RealtimeState } from "./realtime-state";
import { createRefreshDebouncer } from "./refresh-debouncer";
import type { Clock } from "./refresh-debouncer";

// The part of EventSource the controller uses, so tests can stand in for it.
export interface EventSourceLike {
  readonly readyState: number;
  readonly addEventListener: (type: string, listener: () => void) => void;
  readonly close: () => void;
}

const EVENT_SOURCE_CLOSED = 2;

interface ControllerOptions {
  readonly clock: Clock;
  readonly createSource: () => EventSourceLike;
  readonly refresh: () => void;
  readonly isHidden: () => boolean;
  // Subscribes to the tab becoming visible or hidden; returns the unsubscribe.
  readonly onVisibilityChange: (listener: () => void) => () => void;
  readonly debounceMs: number;
  readonly maxWaitMs: number;
  // How often to refresh while the stream is down.
  readonly pollMs: number;
  // How long to wait before reopening a stream the browser gave up on.
  readonly reconnectMs: number;
}

// Keeps one event stream open while the tab is visible and turns what it
// reports into a debounced refresh. It never patches page state: the server
// stays the single source of truth.
export const createRealtimeController = (options: ControllerOptions) => {
  const { clock } = options;
  let state: RealtimeState = initialRealtimeState;
  let source: EventSourceLike | null = null;
  let pollTimer: number | null = null;
  let reconnectTimer: number | null = null;
  let stopWatchingVisibility: (() => void) | null = null;
  let disposed = false;

  const clearTimer = (id: number | null): null => {
    if (id !== null) {
      clock.clearTimer(id);
    }
    return null;
  };

  const closeSource = (): void => {
    source?.close();
    source = null;
  };

  // The steps trigger one another, so they live on one object.
  const steps = {
    connect: (): void => {
      const current = options.createSource();
      source = current;
      const listen = (type: string, handler: () => void): void => {
        current.addEventListener(type, () => {
          if (source === current) {
            handler();
          }
        });
      };
      listen("open", () => {
        reconnectTimer = clearTimer(reconnectTimer);
        steps.dispatch({ type: "opened" });
      });
      listen("change", () => {
        steps.dispatch({ type: "change" });
      });
      listen("resync", () => {
        steps.dispatch({ type: "resync" });
      });
      listen("closed", () => {
        closeSource();
        steps.dispatch({ type: "closed" });
      });
      listen("error", () => {
        steps.dispatch({ type: "errored" });
        // A closed source will not retry by itself (for example after a 401).
        if (current.readyState === EVENT_SOURCE_CLOSED && !reconnectTimer) {
          closeSource();
          reconnectTimer = clock.setTimer(() => {
            reconnectTimer = null;
            if (!disposed && state.connection === "disconnected") {
              steps.connect();
            }
          }, options.reconnectMs);
        }
      });
    },
    debouncer: createRefreshDebouncer({
      clock,
      delayMs: options.debounceMs,
      maxWaitMs: options.maxWaitMs,
      run: () => {
        steps.dispatch({ type: "refreshed" });
        options.refresh();
      },
    }),
    dispatch: (action: RealtimeAction): void => {
      if (disposed) {
        return;
      }
      state = realtimeReducer(state, action);
      steps.settle();
    },
    handleVisibility: (): void => {
      if (options.isHidden()) {
        closeSource();
        steps.dispatch({ type: "hidden" });
        return;
      }
      steps.dispatch({ type: "visible" });
      if (state.connection === "connecting" && source === null) {
        steps.connect();
      }
    },
    // Brings timers in line with the state after every transition.
    settle: (): void => {
      if (state.connection === "paused") {
        steps.debouncer.cancel();
        pollTimer = clearTimer(pollTimer);
        reconnectTimer = clearTimer(reconnectTimer);
        return;
      }
      if (state.refreshPending) {
        steps.debouncer.request();
      }
      if (!shouldPoll(state.connection)) {
        pollTimer = clearTimer(pollTimer);
      } else if (pollTimer === null) {
        pollTimer = clock.setTimer(() => {
          pollTimer = null;
          steps.dispatch({ type: "resync" });
        }, options.pollMs);
      }
    },
  };

  return {
    dispose: (): void => {
      disposed = true;
      closeSource();
      steps.debouncer.cancel();
      pollTimer = clearTimer(pollTimer);
      reconnectTimer = clearTimer(reconnectTimer);
      stopWatchingVisibility?.();
      stopWatchingVisibility = null;
    },
    start: (): void => {
      stopWatchingVisibility = options.onVisibilityChange(
        steps.handleVisibility
      );
      if (options.isHidden()) {
        steps.dispatch({ type: "hidden" });
        return;
      }
      steps.connect();
    },
  };
};
