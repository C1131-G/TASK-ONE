import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";

import type { RealtimeViewer } from "../../src/server/realtime/access";
import { encodeRealtimeEvent } from "../../src/server/realtime/events";
import type { RealtimeEvent } from "../../src/server/realtime/events";
import { createRealtimeHub } from "../../src/server/realtime/hub";
import type {
  HubMessage,
  ListenerHandlers,
} from "../../src/server/realtime/hub";

const flush = async (): Promise<void> => {
  for (let turn = 0; turn < 5; turn += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

const makeHarness = (options: {
  maxConnectionsPerUser?: number;
  authorize?: (
    viewer: RealtimeViewer,
    event: RealtimeEvent
  ) => boolean | Promise<boolean>;
}) => {
  const opened: { handlers: ListenerHandlers; closed: boolean }[] = [];
  const timers: (() => void)[] = [];
  const hub = createRealtimeHub({
    authorize: async (viewer, event) =>
      (await options.authorize?.(viewer, event)) ?? true,
    maxConnectionsPerUser: options.maxConnectionsPerUser ?? 3,
    openListener: (handlers) => {
      const listener = { closed: false, handlers };
      opened.push(listener);
      return Promise.resolve({
        close: () => {
          listener.closed = true;
          return Promise.resolve();
        },
      });
    },
    schedule: (task) => {
      timers.push(task);
      return () => {};
    },
  });
  return { hub, opened, timers };
};

const viewer = (id = randomUUID()): RealtimeViewer => ({
  clientCompanyId: null,
  id,
  role: "employee",
});

const sink = () => {
  const messages: HubMessage[] = [];
  let closed = 0;
  return {
    closedCount: () => closed,
    messages,
    sink: {
      close: () => {
        closed += 1;
      },
      send: (message: HubMessage) => {
        messages.push(message);
      },
    },
  };
};

const taskEvent = (): RealtimeEvent => ({
  kind: "task",
  projectId: randomUUID(),
  taskId: randomUUID(),
});

test("no database connection is opened until someone subscribes", () => {
  const { opened } = makeHarness({});
  expect(opened).toHaveLength(0);
});

test("many subscribers share one listener connection", async () => {
  const { hub, opened } = makeHarness({});
  await hub.subscribe(viewer(), sink().sink);
  await hub.subscribe(viewer(), sink().sink);
  await hub.subscribe(viewer(), sink().sink);
  expect(opened).toHaveLength(1);
});

test("a payload fans out to every authorized subscriber", async () => {
  const { hub, opened } = makeHarness({});
  const first = sink();
  const second = sink();
  await hub.subscribe(viewer(), first.sink);
  await hub.subscribe(viewer(), second.sink);
  const event = taskEvent();
  opened[0]?.handlers.onPayload(encodeRealtimeEvent(event));
  await flush();
  expect(first.messages).toEqual([{ event, type: "event" }]);
  expect(second.messages).toEqual([{ event, type: "event" }]);
});

test("a subscriber the filter rejects never sees the event", async () => {
  const allowed = viewer();
  const denied = viewer();
  const { hub, opened } = makeHarness({
    authorize: (candidate) => candidate.id === allowed.id,
  });
  const allowedSink = sink();
  const deniedSink = sink();
  await hub.subscribe(allowed, allowedSink.sink);
  await hub.subscribe(denied, deniedSink.sink);
  opened[0]?.handlers.onPayload(encodeRealtimeEvent(taskEvent()));
  await flush();
  expect(allowedSink.messages).toHaveLength(1);
  expect(deniedSink.messages).toHaveLength(0);
});

test("a filter that throws fails closed", async () => {
  const { hub, opened } = makeHarness({
    authorize: () => Promise.reject(new Error("lookup failed")),
  });
  const watcher = sink();
  await hub.subscribe(viewer(), watcher.sink);
  opened[0]?.handlers.onPayload(encodeRealtimeEvent(taskEvent()));
  await flush();
  expect(watcher.messages).toHaveLength(0);
});

test("malformed payloads are dropped without reaching anyone", async () => {
  const { hub, opened } = makeHarness({});
  const watcher = sink();
  await hub.subscribe(viewer(), watcher.sink);
  opened[0]?.handlers.onPayload("{broken");
  opened[0]?.handlers.onPayload(JSON.stringify({ kind: "task" }));
  await flush();
  expect(watcher.messages).toHaveLength(0);
});

test("the oldest connection is closed when a user exceeds the limit", async () => {
  const { hub } = makeHarness({ maxConnectionsPerUser: 2 });
  const person = viewer();
  const first = sink();
  const second = sink();
  const third = sink();
  await hub.subscribe(person, first.sink);
  await hub.subscribe(person, second.sink);
  await hub.subscribe(person, third.sink);
  expect(first.closedCount()).toBe(1);
  expect(second.closedCount()).toBe(0);
  expect(third.closedCount()).toBe(0);
  expect(hub.subscriberCount()).toBe(2);
});

test("one user's limit does not evict another user", async () => {
  const { hub } = makeHarness({ maxConnectionsPerUser: 1 });
  const first = sink();
  await hub.subscribe(viewer(), first.sink);
  await hub.subscribe(viewer(), sink().sink);
  expect(first.closedCount()).toBe(0);
});

test("unsubscribing stops delivery and the last one closes the listener", async () => {
  const { hub, opened } = makeHarness({});
  const watcher = sink();
  const unsubscribe = await hub.subscribe(viewer(), watcher.sink);
  unsubscribe();
  await flush();
  expect(hub.subscriberCount()).toBe(0);
  expect(opened[0]?.closed).toBe(true);
  opened[0]?.handlers.onPayload(encodeRealtimeEvent(taskEvent()));
  await flush();
  expect(watcher.messages).toHaveLength(0);
});

test("unsubscribing twice is harmless", async () => {
  const { hub } = makeHarness({});
  const unsubscribe = await hub.subscribe(viewer(), sink().sink);
  unsubscribe();
  unsubscribe();
  expect(hub.subscriberCount()).toBe(0);
});

test("a lost listener reconnects and tells everyone to catch up", async () => {
  const { hub, opened, timers } = makeHarness({});
  const watcher = sink();
  await hub.subscribe(viewer(), watcher.sink);
  opened[0]?.handlers.onLost();
  expect(timers).toHaveLength(1);
  timers[0]?.();
  await flush();
  expect(opened).toHaveLength(2);
  expect(watcher.messages).toEqual([{ type: "resync" }]);
});

test("a listener lost after everyone left does not reconnect", async () => {
  const { hub, opened, timers } = makeHarness({});
  const unsubscribe = await hub.subscribe(viewer(), sink().sink);
  opened[0]?.handlers.onLost();
  unsubscribe();
  timers[0]?.();
  await flush();
  expect(opened).toHaveLength(1);
});

test("a sink that throws is removed instead of breaking the fan-out", async () => {
  const { hub, opened } = makeHarness({});
  const healthy = sink();
  await hub.subscribe(viewer(), {
    close: () => {},
    send: () => {
      throw new Error("stream closed");
    },
  });
  await hub.subscribe(viewer(), healthy.sink);
  opened[0]?.handlers.onPayload(encodeRealtimeEvent(taskEvent()));
  await flush();
  expect(healthy.messages).toHaveLength(1);
  expect(hub.subscriberCount()).toBe(1);
});

test("a failed first connection keeps the stream open and retries with a resync", async () => {
  let attempts = 0;
  const timers: (() => void)[] = [];
  const hub = createRealtimeHub({
    authorize: () => Promise.resolve(true),
    maxConnectionsPerUser: 3,
    openListener: () => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new Error("refused"))
        : Promise.resolve({ close: () => Promise.resolve() });
    },
    schedule: (task) => {
      timers.push(task);
      return () => {};
    },
  });
  const watcher = sink();
  await hub.subscribe(viewer(), watcher.sink);
  expect(hub.subscriberCount()).toBe(1);
  expect(timers).toHaveLength(1);
  timers[0]?.();
  await flush();
  expect(attempts).toBe(2);
  expect(watcher.messages).toEqual([{ type: "resync" }]);
});
