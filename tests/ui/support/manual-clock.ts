export interface ManualClock {
  readonly now: () => number;
  readonly setTimer: (task: () => void, delayMs: number) => number;
  readonly clearTimer: (id: number) => void;
  readonly advance: (milliseconds: number) => void;
  readonly pendingTimers: () => number;
}

// A fake clock whose timers fire only when the test advances time.
export const createManualClock = (): ManualClock => {
  let current = 0;
  let nextId = 1;
  const timers = new Map<
    number,
    { readonly at: number; readonly task: () => void }
  >();
  const dueTimer = (limit: number) =>
    [...timers.entries()]
      .filter(([, timer]) => timer.at <= limit)
      .toSorted(([, first], [, second]) => first.at - second.at)[0];
  return {
    advance: (milliseconds) => {
      const target = current + milliseconds;
      for (let due = dueTimer(target); due; due = dueTimer(target)) {
        const [id, timer] = due;
        timers.delete(id);
        current = timer.at;
        timer.task();
      }
      current = target;
    },
    clearTimer: (id) => {
      timers.delete(id);
    },
    now: () => current,
    pendingTimers: () => timers.size,
    setTimer: (task, delayMs) => {
      const id = nextId;
      nextId += 1;
      timers.set(id, { at: current + delayMs, task });
      return id;
    },
  };
};
