import { expect, test } from "bun:test";

import { createRealtimeController } from "../../features/realtime/realtime-controller";
import type { EventSourceLike } from "../../features/realtime/realtime-controller";
import { createManualClock } from "./support/manual-clock";

const CLOSED = 2;

class FakeSource implements EventSourceLike {
  readyState = 0;
  closed = false;
  readonly listeners = new Map<string, (() => void)[]>();
  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close(): void {
    this.closed = true;
    this.readyState = CLOSED;
  }
  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }
}

const setup = (hidden = false) => {
  const clock = createManualClock();
  const sources: FakeSource[] = [];
  let refreshes = 0;
  let isHidden = hidden;
  let visibilityListener: (() => void) | null = null;
  const controller = createRealtimeController({
    clock,
    createSource: () => {
      const source = new FakeSource();
      sources.push(source);
      return source;
    },
    debounceMs: 300,
    isHidden: () => isHidden,
    maxWaitMs: 1000,
    onVisibilityChange: (listener) => {
      visibilityListener = listener;
      return () => {
        visibilityListener = null;
      };
    },
    pollMs: 60_000,
    reconnectMs: 30_000,
    refresh: () => {
      refreshes += 1;
    },
  });
  return {
    clock,
    controller,
    refreshes: () => refreshes,
    setHidden: (value: boolean) => {
      isHidden = value;
      visibilityListener?.();
    },
    sources,
  };
};

test("a visible tab opens one stream and does not refresh by itself", () => {
  const { controller, refreshes, sources } = setup();
  controller.start();
  expect(sources).toHaveLength(1);
  sources[0]?.emit("open");
  expect(refreshes()).toBe(0);
});

test("a hidden tab opens no stream at start", () => {
  const { controller, sources } = setup(true);
  controller.start();
  expect(sources).toHaveLength(0);
});

test("changes debounce into a single refresh", () => {
  const { clock, controller, refreshes, sources } = setup();
  controller.start();
  sources[0]?.emit("open");
  sources[0]?.emit("change");
  sources[0]?.emit("change");
  sources[0]?.emit("change");
  expect(refreshes()).toBe(0);
  clock.advance(300);
  expect(refreshes()).toBe(1);
  clock.advance(5000);
  expect(refreshes()).toBe(1);
});

test("a resync from the server refreshes", () => {
  const { clock, controller, refreshes, sources } = setup();
  controller.start();
  sources[0]?.emit("resync");
  clock.advance(300);
  expect(refreshes()).toBe(1);
});

test("hiding the tab closes the stream and showing it reconnects with a catch-up refresh", () => {
  const { clock, controller, refreshes, setHidden, sources } = setup();
  controller.start();
  sources[0]?.emit("open");
  setHidden(true);
  expect(sources[0]?.closed).toBe(true);
  setHidden(false);
  expect(sources).toHaveLength(2);
  clock.advance(300);
  expect(refreshes()).toBe(1);
});

test("a change that lands just before hiding does not refresh in the background", () => {
  const { clock, controller, refreshes, setHidden, sources } = setup();
  controller.start();
  sources[0]?.emit("open");
  sources[0]?.emit("change");
  setHidden(true);
  clock.advance(10_000);
  expect(refreshes()).toBe(0);
  setHidden(false);
  clock.advance(300);
  expect(refreshes()).toBe(1);
});

test("a dropped stream catches up once it reopens", () => {
  const { clock, controller, refreshes, sources } = setup();
  controller.start();
  sources[0]?.emit("open");
  sources[0]?.emit("error");
  sources[0]?.emit("open");
  clock.advance(300);
  expect(refreshes()).toBe(1);
});

test("while the stream is down the page refreshes on a slow poll", () => {
  const { clock, controller, refreshes, sources } = setup();
  controller.start();
  sources[0]?.emit("open");
  sources[0]?.emit("error");
  clock.advance(60_000);
  clock.advance(300);
  expect(refreshes()).toBe(1);
});

test("the poll stops once the stream is back", () => {
  const { clock, controller, refreshes, sources } = setup();
  controller.start();
  sources[0]?.emit("error");
  sources[0]?.emit("open");
  clock.advance(300);
  const afterCatchUp = refreshes();
  clock.advance(120_000);
  expect(refreshes()).toBe(afterCatchUp);
});

test("a stream the browser gave up on is reopened after a pause", () => {
  const { clock, controller, sources } = setup();
  controller.start();
  const [first] = sources;
  if (first) {
    first.readyState = CLOSED;
  }
  first?.emit("error");
  expect(sources).toHaveLength(1);
  clock.advance(30_000);
  expect(sources).toHaveLength(2);
});

test("a stream the server closed for good is not reopened", () => {
  const { clock, controller, sources } = setup();
  controller.start();
  sources[0]?.emit("closed");
  expect(sources[0]?.closed).toBe(true);
  clock.advance(120_000);
  expect(sources).toHaveLength(1);
});

test("dispose closes the stream, stops timers and ignores later events", () => {
  const { clock, controller, refreshes, sources } = setup();
  controller.start();
  sources[0]?.emit("change");
  controller.dispose();
  expect(sources[0]?.closed).toBe(true);
  sources[0]?.emit("change");
  clock.advance(120_000);
  expect(refreshes()).toBe(0);
  expect(clock.pendingTimers()).toBe(0);
});

test("a stale stream's events are ignored after reconnecting", () => {
  const { clock, controller, refreshes, setHidden, sources } = setup();
  controller.start();
  setHidden(true);
  setHidden(false);
  clock.advance(300);
  const afterCatchUp = refreshes();
  sources[0]?.emit("change");
  clock.advance(300);
  expect(refreshes()).toBe(afterCatchUp);
});
