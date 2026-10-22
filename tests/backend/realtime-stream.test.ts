import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";

import type { RealtimeViewer } from "../../src/server/realtime/access";
import type { RealtimeEvent } from "../../src/server/realtime/events";
import type { HubSink } from "../../src/server/realtime/hub";
import { createRealtimeStream } from "../../src/server/realtime/stream";

const viewer: RealtimeViewer = {
  clientCompanyId: null,
  id: randomUUID(),
  role: "employee",
};

const makeHarness = (lastEventId: string | null = null) => {
  const abort = new AbortController();
  let sink: HubSink | null = null;
  let unsubscribed = 0;
  let ping: (() => void) | null = null;
  let pingCancelled = 0;
  const stream = createRealtimeStream({
    hub: {
      subscribe: (_viewer, next) => {
        sink = next;
        return Promise.resolve(() => {
          unsubscribed += 1;
        });
      },
    },
    lastEventId,
    schedulePing: (task) => {
      ping = task;
      return () => {
        pingCancelled += 1;
      };
    },
    signal: abort.signal,
    viewer,
  });
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const read = async (): Promise<string> => {
    const { value } = await reader.read();
    return value ? decoder.decode(value) : "";
  };
  return {
    abort,
    firePing: () => ping?.(),
    pingCancelled: () => pingCancelled,
    read,
    reader,
    sink: () => sink,
    unsubscribed: () => unsubscribed,
  };
};

const event: RealtimeEvent = {
  kind: "task",
  projectId: randomUUID(),
  taskId: randomUUID(),
};

test("a new stream announces the retry delay and that it is connected", async () => {
  const harness = makeHarness();
  const first = await harness.read();
  expect(first).toContain("retry: ");
  expect(first).toContain(": connected");
  expect(first).not.toContain("event: resync");
});

test("a hub event is written as an id-tagged change message with ids only", async () => {
  const harness = makeHarness();
  await harness.read();
  harness.sink()?.send({ event, type: "event" });
  const message = await harness.read();
  expect(message).toMatch(/^id: .+\nevent: change\ndata: /u);
  const data = message.split("data: ")[1]?.trim() ?? "";
  expect(JSON.parse(data)).toEqual(event);
});

test("event ids increase within a stream", async () => {
  const harness = makeHarness();
  await harness.read();
  harness.sink()?.send({ event, type: "event" });
  harness.sink()?.send({ event, type: "event" });
  const ids = [await harness.read(), await harness.read()].map(
    (message) => message.split("\n")[0]
  );
  expect(ids[0]).toStartWith("id: ");
  expect(ids[1]).toStartWith("id: ");
  expect(ids[0]).not.toBe(ids[1]);
});

test("a reconnect with Last-Event-ID is told to catch up straight away", async () => {
  const harness = makeHarness("old-1");
  await harness.read();
  expect(await harness.read()).toContain("event: resync");
});

test("a hub resync becomes a resync message", async () => {
  const harness = makeHarness();
  await harness.read();
  harness.sink()?.send({ type: "resync" });
  expect(await harness.read()).toContain("event: resync");
});

test("a heartbeat comment keeps idle connections alive", async () => {
  const harness = makeHarness();
  await harness.read();
  harness.firePing();
  expect(await harness.read()).toBe(": ping\n\n");
});

test("aborting the request unsubscribes, stops the heartbeat and ends the stream", async () => {
  const harness = makeHarness();
  await harness.read();
  harness.abort.abort();
  const { done } = await harness.reader.read();
  expect(done).toBe(true);
  expect(harness.unsubscribed()).toBe(1);
  expect(harness.pingCancelled()).toBe(1);
});

test("cancelling the response body tears down once", async () => {
  const harness = makeHarness();
  await harness.read();
  await harness.reader.cancel();
  expect(harness.unsubscribed()).toBe(1);
  expect(harness.pingCancelled()).toBe(1);
  harness.abort.abort();
  expect(harness.unsubscribed()).toBe(1);
});

test("an already aborted request never subscribes", async () => {
  const abort = new AbortController();
  abort.abort();
  let subscribed = 0;
  const stream = createRealtimeStream({
    hub: {
      subscribe: () => {
        subscribed += 1;
        return Promise.resolve(() => {});
      },
    },
    lastEventId: null,
    schedulePing: () => () => {},
    signal: abort.signal,
    viewer,
  });
  const { done } = await stream.getReader().read();
  expect(done).toBe(true);
  expect(subscribed).toBe(0);
});

test("a connection the hub evicts says so and ends", async () => {
  const harness = makeHarness();
  await harness.read();
  harness.sink()?.close();
  expect(await harness.read()).toContain("event: closed");
  const { done } = await harness.reader.read();
  expect(done).toBe(true);
});

test("a send after the stream ended is ignored", async () => {
  const harness = makeHarness();
  await harness.read();
  harness.abort.abort();
  await harness.reader.read();
  expect(() => harness.sink()?.send({ event, type: "event" })).not.toThrow();
});
