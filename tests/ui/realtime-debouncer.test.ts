import { expect, test } from "bun:test";

import { createRefreshDebouncer } from "../../features/realtime/refresh-debouncer";
import { createManualClock } from "./support/manual-clock";

const setup = () => {
  const clock = createManualClock();
  let runs = 0;
  const debouncer = createRefreshDebouncer({
    clock,
    delayMs: 300,
    maxWaitMs: 1000,
    run: () => {
      runs += 1;
    },
  });
  return { clock, debouncer, runs: () => runs };
};

test("a single request runs once after the delay", () => {
  const { clock, debouncer, runs } = setup();
  debouncer.request();
  clock.advance(299);
  expect(runs()).toBe(0);
  clock.advance(1);
  expect(runs()).toBe(1);
});

test("a burst of requests collapses into one run", () => {
  const { clock, debouncer, runs } = setup();
  for (let index = 0; index < 5; index += 1) {
    debouncer.request();
    clock.advance(100);
  }
  clock.advance(300);
  expect(runs()).toBe(1);
});

test("a constant stream cannot starve the refresh past the maximum wait", () => {
  const { clock, debouncer, runs } = setup();
  for (let index = 0; index < 20; index += 1) {
    debouncer.request();
    clock.advance(100);
  }
  expect(runs()).toBeGreaterThanOrEqual(1);
  expect(runs()).toBeLessThanOrEqual(3);
});

test("cancel drops the pending run", () => {
  const { clock, debouncer, runs } = setup();
  debouncer.request();
  debouncer.cancel();
  clock.advance(5000);
  expect(runs()).toBe(0);
});

test("a request after a run starts a fresh window", () => {
  const { clock, debouncer, runs } = setup();
  debouncer.request();
  clock.advance(300);
  debouncer.request();
  clock.advance(300);
  expect(runs()).toBe(2);
});
