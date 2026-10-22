import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";

import type { RealtimeEvent } from "../../src/server/realtime/events";
import {
  createNotifyPublisher,
  createRealtimeOutbox,
} from "../../src/server/realtime/outbox";

const inbox = (): RealtimeEvent => ({ kind: "inbox", userId: randomUUID() });

const recorder = () => {
  const published: RealtimeEvent[][] = [];
  return {
    publish: (events: readonly RealtimeEvent[]) => {
      published.push([...events]);
      return Promise.resolve();
    },
    published,
  };
};

test("events queued in a scope publish once, after the scope succeeds", async () => {
  const { published, publish } = recorder();
  const outbox = createRealtimeOutbox(publish);
  const first = inbox();
  const second = inbox();
  await outbox.scope(() => {
    outbox.queue([first]);
    outbox.queue([second]);
    expect(published).toHaveLength(0);
    return Promise.resolve();
  });
  expect(published).toEqual([[first, second]]);
});

test("a failed scope publishes nothing, so a rolled back write never signals", async () => {
  const { published, publish } = recorder();
  const outbox = createRealtimeOutbox(publish);
  const failure = outbox.scope(() => {
    outbox.queue([inbox()]);
    return Promise.reject(new Error("rolled back"));
  });
  await expect(failure).rejects.toThrow("rolled back");
  expect(published).toHaveLength(0);
});

test("duplicate events in one scope collapse to one", async () => {
  const { published, publish } = recorder();
  const outbox = createRealtimeOutbox(publish);
  const event = inbox();
  await outbox.scope(() => {
    outbox.queue([event, { ...event }]);
    outbox.queue([event]);
    return Promise.resolve();
  });
  expect(published).toEqual([[event]]);
});

test("a nested scope defers to the outermost one", async () => {
  const { published, publish } = recorder();
  const outbox = createRealtimeOutbox(publish);
  const event = inbox();
  await outbox.scope(async () => {
    await outbox.scope(() => {
      outbox.queue([event]);
      return Promise.resolve();
    });
    expect(published).toHaveLength(0);
  });
  expect(published).toEqual([[event]]);
});

test("outside any scope events publish immediately", async () => {
  const { published, publish } = recorder();
  const outbox = createRealtimeOutbox(publish);
  const event = inbox();
  outbox.queue([event]);
  await Promise.resolve();
  expect(published).toEqual([[event]]);
});

test("concurrent scopes keep their events apart", async () => {
  const { published, publish } = recorder();
  const outbox = createRealtimeOutbox(publish);
  const kept = inbox();
  const dropped = inbox();
  const results = await Promise.allSettled([
    outbox.scope(async () => {
      outbox.queue([dropped]);
      await Promise.resolve();
      throw new Error("rolled back");
    }),
    outbox.scope(async () => {
      await Promise.resolve();
      outbox.queue([kept]);
    }),
  ]);
  expect(results[0]?.status).toBe("rejected");
  expect(published).toEqual([[kept]]);
});

test("the notify publisher sends one JSON payload per event on the channel", async () => {
  const calls: { sql: string; values: readonly unknown[] }[] = [];
  const publisher = createNotifyPublisher((sql, values) => {
    calls.push({ sql, values });
    return Promise.resolve();
  });
  const event = inbox();
  await publisher([event]);
  expect(calls).toHaveLength(1);
  expect(calls[0]?.sql).toContain("pg_notify");
  expect(calls[0]?.values).toEqual([
    "metsys_realtime",
    [JSON.stringify(event)],
  ]);
});

test("a publish failure is swallowed so a committed write never fails", async () => {
  const publisher = createNotifyPublisher(() =>
    Promise.reject(new Error("database down"))
  );
  await expect(publisher([inbox()])).resolves.toBeUndefined();
});

test("publishing no events sends nothing", async () => {
  let called = false;
  const publisher = createNotifyPublisher(() => {
    called = true;
    return Promise.resolve();
  });
  await publisher([]);
  expect(called).toBe(false);
});
