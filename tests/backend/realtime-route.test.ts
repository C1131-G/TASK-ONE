import { afterAll, beforeAll, expect, it, mock } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";
import { Client } from "pg";

import {
  authPool,
  ids,
  personaHeaders,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import type { Persona } from "./support/action-harness";

// `connection()` only opts the route out of prerendering.
mock.module("next/server", () => ({ connection: () => Promise.resolve() }));

const { GET } = await import("../../apps/web/app/api/events/route");
const { createComment } =
  await import("../../src/server/collaboration/create-comment");
const { db } = await import("../../src/prisma/db");
const { queueRealtimeEvents } =
  await import("../../src/server/realtime/publisher");

const decoder = new TextDecoder();
const SETTLE_MS = 500;
const aborts: AbortController[] = [];

beforeAll(setupHarness);
afterAll(async () => {
  for (const controller of aborts) {
    controller.abort();
  }
  await teardownHarness();
});

const sleep = (milliseconds: number): Promise<void> => Bun.sleep(milliseconds);

const connect = async (
  persona: Persona,
  extraHeaders: Record<string, string> = {}
) => {
  const abort = new AbortController();
  aborts.push(abort);
  const headers = new Headers(personaHeaders(persona));
  for (const [name, value] of Object.entries(extraHeaders)) {
    headers.set(name, value);
  }
  const response = await GET(
    new Request("http://localhost:3000/api/events", {
      headers,
      signal: abort.signal,
    })
  );
  let text = "";
  const reader = response.body?.getReader();
  if (reader) {
    void (async () => {
      for (;;) {
        // eslint-disable-next-line no-await-in-loop
        const chunk = await reader
          .read()
          .catch(() => ({ done: true }) as const);
        if (chunk.done) {
          return;
        }
        text += decoder.decode(chunk.value);
      }
    })();
  }
  return {
    abort,
    response,
    // Everything received since the last call.
    take: async (): Promise<string> => {
      await sleep(SETTLE_MS);
      const received = text;
      text = "";
      return received;
    },
  };
};

it("rejects visitors, deactivated users and users who must change their password", async () => {
  const anonymous = await connect("anonymous");
  const deactivated = await connect("deactivated");
  const forced = await connect("forced");
  expect(anonymous.response.status).toBe(401);
  expect(deactivated.response.status).toBe(401);
  expect(forced.response.status).toBe(403);
});

it("opens an event stream for an active employee with safe headers", async () => {
  const stream = await connect("owner");
  expect(stream.response.status).toBe(200);
  expect(stream.response.headers.get("content-type")).toContain(
    "text/event-stream"
  );
  expect(stream.response.headers.get("cache-control")).toContain("no-store");
  expect(await stream.take()).toContain(": connected");
});

it("tells a reconnecting browser to catch up", async () => {
  const stream = await connect("owner", { "last-event-id": "abc-1" });
  expect(await stream.take()).toContain("event: resync");
});

it("pushes a task comment to staff as ids only, and never to a client", async () => {
  const staff = await connect("admin");
  const client = await connect("client");
  const otherClient = await connect("otherClient");
  await staff.take();
  await client.take();
  await otherClient.take();
  const secret = `secret-${randomUUID()}`;
  await Effect.runPromise(
    createComment(personaId("owner"), ids.taskId, secret)
  );
  const staffText = await staff.take();
  expect(staffText).toContain("event: change");
  expect(staffText).toContain(ids.taskId);
  expect(staffText).not.toContain(secret);
  expect(await client.take()).not.toContain("event: change");
  expect(await otherClient.take()).not.toContain("event: change");
});

it("publishes after commit and never for a rolled back transaction", async () => {
  const listener = new Client({
    connectionString: process.env["DATABASE_URL"],
  });
  await listener.connect();
  const received: string[] = [];
  listener.on("notification", (message) => {
    if (message.payload) {
      received.push(message.payload);
    }
  });
  await listener.query("LISTEN taskora_realtime");
  try {
    const rolledBack = randomUUID();
    await db
      .transaction(() => {
        queueRealtimeEvents([{ kind: "inbox", userId: rolledBack }]);
        throw new Error("rollback");
      })
      .catch(() => {});
    const committed = randomUUID();
    await db.transaction(() => {
      queueRealtimeEvents([{ kind: "inbox", userId: committed }]);
      return Promise.resolve();
    });
    await sleep(SETTLE_MS);
    expect(received.some((payload) => payload.includes(committed))).toBe(true);
    expect(received.some((payload) => payload.includes(rolledBack))).toBe(
      false
    );
  } finally {
    await listener.end();
  }
});

it("delivers a user's inbox event only to that user", async () => {
  const target = await connect("owner");
  const bystander = await connect("outsider");
  await target.take();
  await bystander.take();
  await authPool.query("SELECT pg_notify('taskora_realtime', $1)", [
    JSON.stringify({ kind: "inbox", userId: personaId("owner") }),
  ]);
  expect(await target.take()).toContain("event: change");
  expect(await bystander.take()).not.toContain("event: change");
});

it("ignores a forged or malformed notification payload", async () => {
  const watcher = await connect("owner");
  await watcher.take();
  await authPool.query("SELECT pg_notify('taskora_realtime', $1)", ["{nope"]);
  await authPool.query("SELECT pg_notify('taskora_realtime', $1)", [
    JSON.stringify({ kind: "inbox", userId: "not-a-uuid" }),
  ]);
  expect(await watcher.take()).not.toContain("event: change");
});

it("stops delivering after the request is aborted", async () => {
  const watcher = await connect("owner");
  await watcher.take();
  watcher.abort.abort();
  await sleep(100);
  await authPool.query("SELECT pg_notify('taskora_realtime', $1)", [
    JSON.stringify({ kind: "inbox", userId: personaId("owner") }),
  ]);
  expect(await watcher.take()).not.toContain("event: change");
});
