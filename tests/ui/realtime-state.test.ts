import { expect, test } from "bun:test";

import {
  initialRealtimeState,
  realtimeReducer,
  shouldPoll,
} from "../../features/realtime/realtime-state";
import type {
  RealtimeAction,
  RealtimeState,
} from "../../features/realtime/realtime-state";

const run = (actions: readonly RealtimeAction[]): RealtimeState => {
  let state = initialRealtimeState;
  for (const action of actions) {
    state = realtimeReducer(state, action);
  }
  return state;
};

test("a fresh connection starts connecting with nothing to refresh", () => {
  expect(initialRealtimeState).toEqual({
    connection: "connecting",
    refreshPending: false,
  });
});

test("the first open does not trigger a refresh", () => {
  expect(run([{ type: "opened" }])).toEqual({
    connection: "open",
    refreshPending: false,
  });
});

test("a change or a resync marks a refresh as pending", () => {
  expect(run([{ type: "opened" }, { type: "change" }]).refreshPending).toBe(
    true
  );
  expect(run([{ type: "opened" }, { type: "resync" }]).refreshPending).toBe(
    true
  );
});

test("a completed refresh clears the pending flag", () => {
  const state = run([
    { type: "opened" },
    { type: "change" },
    { type: "refreshed" },
  ]);
  expect(state.refreshPending).toBe(false);
});

test("reconnecting after a drop asks for a catch-up refresh", () => {
  const state = run([
    { type: "opened" },
    { type: "errored" },
    { type: "opened" },
  ]);
  expect(state).toEqual({ connection: "open", refreshPending: true });
});

test("an error leaves the connection disconnected without losing pending work", () => {
  const state = run([
    { type: "opened" },
    { type: "change" },
    { type: "errored" },
  ]);
  expect(state).toEqual({ connection: "disconnected", refreshPending: true });
});

test("a hidden tab pauses and becoming visible catches up", () => {
  const paused = run([{ type: "opened" }, { type: "hidden" }]);
  expect(paused.connection).toBe("paused");
  const resumed = realtimeReducer(paused, { type: "visible" });
  expect(resumed).toEqual({ connection: "connecting", refreshPending: true });
});

test("a paused tab ignores stray events instead of scheduling work", () => {
  const state = run([
    { type: "opened" },
    { type: "hidden" },
    { type: "change" },
    { type: "errored" },
  ]);
  expect(state).toEqual({ connection: "paused", refreshPending: false });
});

test("visible without a prior pause changes nothing", () => {
  const state = run([{ type: "opened" }, { type: "visible" }]);
  expect(state).toEqual({ connection: "open", refreshPending: false });
});

test("the server closing the stream is final", () => {
  const state = run([
    { type: "opened" },
    { type: "closed" },
    { type: "opened" },
  ]);
  expect(state.connection).toBe("closed");
});

test("only disconnected or closed streams fall back to polling", () => {
  expect(shouldPoll("connecting")).toBe(false);
  expect(shouldPoll("open")).toBe(false);
  expect(shouldPoll("paused")).toBe(false);
  expect(shouldPoll("disconnected")).toBe(true);
  expect(shouldPoll("closed")).toBe(true);
});
