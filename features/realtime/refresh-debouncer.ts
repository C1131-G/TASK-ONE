export interface Clock {
  readonly now: () => number;
  readonly setTimer: (task: () => void, delayMs: number) => number;
  readonly clearTimer: (id: number) => void;
}

interface DebouncerOptions {
  readonly clock: Clock;
  readonly delayMs: number;
  // The longest a steady stream of requests can postpone the run.
  readonly maxWaitMs: number;
  readonly run: () => void;
}

// Collapses a burst of requests into one trailing run, but never delays the
// run beyond maxWaitMs after the first request of the burst.
export const createRefreshDebouncer = ({
  clock,
  delayMs,
  maxWaitMs,
  run,
}: DebouncerOptions) => {
  let timer: number | null = null;
  let firstRequestAt = 0;

  const cancel = (): void => {
    if (timer !== null) {
      clock.clearTimer(timer);
      timer = null;
    }
  };

  const fire = (): void => {
    timer = null;
    run();
  };

  const request = (): void => {
    const now = clock.now();
    if (timer === null) {
      firstRequestAt = now;
    } else {
      clock.clearTimer(timer);
    }
    const remaining = Math.max(0, firstRequestAt + maxWaitMs - now);
    timer = clock.setTimer(fire, Math.min(delayMs, remaining));
  };

  return { cancel, request };
};
