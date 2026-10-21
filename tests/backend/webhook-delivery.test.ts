import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { db } from "../../src/prisma/db";
import { authPool } from "../../src/server/auth/database";
import { deliverWebhook } from "../../src/server/webhooks/webhook-delivery";
import type { DeliveryDeps } from "../../src/server/webhooks/webhook-delivery";
import { enqueueWebhookEvent } from "../../src/server/webhooks/webhook-enqueue";
import {
  WebhookManagement,
  WebhookManagementLive,
} from "../../src/server/webhooks/webhook-management";
import { webhookKeyMaterial } from "../../src/server/webhooks/webhook-secret";
import { verifyWebhookSignature } from "../../src/server/webhooks/webhook-signing";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";
const KEY = webhookKeyMaterial();

const domain = "webhook-delivery.example";
const adminId = randomUUID();

const manage = <Value>(
  program: (
    service: WebhookManagement["Service"]
  ) => Effect.Effect<Value, unknown>
) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* use() {
        return yield* program(yield* WebhookManagement);
      }),
      WebhookManagementLive
    )
  );

beforeAll(async () => {
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [adminId, "Webhook Admin", `${adminId}@${domain}`, "admin"]
  );
});

afterAll(async () => {
  await authPool.query(
    'DELETE FROM webhook_endpoint WHERE "createdById" = $1',
    [adminId]
  );
  await authPool.query('DELETE FROM activity WHERE "actorId" = $1', [adminId]);
  await authPool.query("DELETE FROM job WHERE kind = 'webhooks.deliver'");
  await authPool.query('DELETE FROM "user" WHERE email LIKE $1', [
    `%@${domain}`,
  ]);
});

interface Sent {
  readonly address: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly url: string;
}

const resolvesTo =
  (address: string, family: 4 | 6 = 4) =>
  () =>
    Promise.resolve([{ address, family }]);
const publicResolver = resolvesTo("93.184.216.34");

const makeDeps = (
  respond: () => { status: number; bodySnippet: string } | Error,
  overrides: Partial<DeliveryDeps> = {}
): { deps: DeliveryDeps; sent: Sent[] } => {
  const sent: Sent[] = [];
  return {
    deps: {
      keyMaterial: KEY,
      now: () => new Date("2026-10-21T10:00:00.000Z"),
      post: (request) => {
        sent.push({
          address: request.address,
          body: request.body,
          headers: request.headers,
          url: request.url.toString(),
        });
        const result = respond();
        return result instanceof Error
          ? Promise.reject(result)
          : Promise.resolve(result);
      },
      production: true,
      resolve: publicResolver,
      ...overrides,
    },
    sent,
  };
};

const createGeneric = async (events: string[] = ["task.created"]) => {
  const created = await manage((service) =>
    service.create(adminId, {
      events: events.filter(
        (event): event is "task.created" => event === "task.created"
      ),
      kind: "generic",
      name: "Receiver",
      url: "https://receiver.example.com/in",
    })
  );
  return { id: created.endpoint.id, secret: created.secret ?? "" };
};

const emit = (data: Record<string, unknown>, eventId = randomUUID()) =>
  db.transaction((transaction) =>
    enqueueWebhookEvent(transaction, "task.created", {
      data,
      eventId,
      now: new Date("2026-10-21T10:00:00.000Z"),
    })
  );

const deliveriesFor = async (endpointId: string) => {
  const rows = await authPool.query<{
    id: string;
    eventId: string;
    status: string;
    attempts: number;
    responseCode: number | null;
    responseBody: string | null;
    lastError: string | null;
    payload: Record<string, unknown>;
  }>(
    'SELECT id, "eventId", status, attempts, "responseCode", "responseBody", "lastError", payload FROM webhook_delivery WHERE "endpointId" = $1 ORDER BY "createdAt"',
    [endpointId]
  );
  return rows.rows;
};

const taskData = {
  description: "<p>internal</p>",
  id: "task-1",
  priority: "high",
  projectId: "project-1",
  projectTaskNumber: 4,
  status: "todo",
  title: "Write docs",
};

const deliver = (id: string, deps: DeliveryDeps) =>
  Effect.runPromise(Effect.result(deliverWebhook(id, deps)));

it("queues one delivery and job per subscribed, enabled endpoint, once per event", async () => {
  const subscribed = await createGeneric();
  const other = await createGeneric();
  await manage((service) =>
    service.update(adminId, other.id, {
      enabled: false,
      events: ["task.created"],
      name: "Off",
      url: "https://receiver.example.com/in",
    })
  );
  const unsubscribed = await manage((service) =>
    service.create(adminId, {
      events: ["project.created"],
      kind: "generic",
      name: "Other event",
      url: "https://receiver.example.com/in",
    })
  );
  const eventId = randomUUID();
  await emit(taskData, eventId);
  await emit(taskData, eventId);

  const rows = await deliveriesFor(subscribed.id);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ attempts: 0, eventId, status: "pending" });
  // Only public fields are stored in the payload.
  expect(rows[0]?.payload).toMatchObject({
    data: { id: "task-1", title: "Write docs" },
    type: "task.created",
  });
  expect(JSON.stringify(rows[0]?.payload)).not.toContain("internal");
  expect(await deliveriesFor(other.id)).toHaveLength(0);
  expect(await deliveriesFor(unsubscribed.endpoint.id)).toHaveLength(0);

  const jobs = await authPool.query<{
    kind: string;
    maxAttempts: number;
    payload: { deliveryId: string };
  }>('SELECT kind, "maxAttempts", payload FROM job WHERE "dedupeKey" = $1', [
    `webhook:${subscribed.id}:${eventId}`,
  ]);
  expect(jobs.rows).toHaveLength(1);
  expect(jobs.rows[0]).toMatchObject({
    kind: "webhooks.deliver",
    maxAttempts: 6,
    payload: { deliveryId: rows[0]?.id },
  });
});

it("signs the body with the endpoint secret and records success", async () => {
  const endpoint = await createGeneric();
  await emit(taskData);
  const [delivery] = await deliveriesFor(endpoint.id);
  const { deps, sent } = makeDeps(() => ({ bodySnippet: "ok", status: 204 }));

  const outcome = await deliver(delivery?.id ?? "", deps);
  expect(outcome._tag).toBe("Success");
  expect(sent).toHaveLength(1);
  const [request] = sent;
  expect(request?.address).toBe("93.184.216.34");
  expect(request?.headers["x-metsys-event"]).toBe("task.created");
  expect(request?.headers["x-metsys-delivery"]).toBe(delivery?.eventId ?? "");
  const timestamp = Number(request?.headers["x-metsys-timestamp"]);
  expect(timestamp).toBe(Date.parse("2026-10-21T10:00:00.000Z") / 1000);
  expect(
    verifyWebhookSignature(
      endpoint.secret,
      timestamp,
      request?.body ?? "",
      request?.headers["x-metsys-signature"] ?? "",
      timestamp
    )
  ).toBe(true);
  expect(JSON.parse(request?.body ?? "{}")).toMatchObject({
    id: delivery?.eventId,
    type: "task.created",
  });

  const [after] = await deliveriesFor(endpoint.id);
  expect(after).toMatchObject({
    attempts: 1,
    lastError: null,
    responseCode: 204,
    status: "succeeded",
  });

  // A duplicate job for a delivery that already succeeded sends nothing.
  const again = await deliver(delivery?.id ?? "", deps);
  expect(again._tag).toBe("Success");
  expect(sent).toHaveLength(1);
});

it("retries server errors, then dead-letters after the last attempt, keeping a truncated body", async () => {
  const endpoint = await createGeneric();
  await emit(taskData);
  const [delivery] = await deliveriesFor(endpoint.id);
  const { deps, sent } = makeDeps(() => ({
    bodySnippet: "e".repeat(5000),
    status: 503,
  }));

  for (let attempt = 1; attempt < 6; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const outcome = await deliver(delivery?.id ?? "", deps);
    expect(outcome._tag).toBe("Failure");
    // eslint-disable-next-line no-await-in-loop
    const [row] = await deliveriesFor(endpoint.id);
    expect(row?.status).toBe("retrying");
    expect(row?.attempts).toBe(attempt);
  }
  const last = await deliver(delivery?.id ?? "", deps);
  expect(last._tag).toBe("Failure");
  const [dead] = await deliveriesFor(endpoint.id);
  expect(dead).toMatchObject({
    attempts: 6,
    responseCode: 503,
    status: "dead",
  });
  expect(dead?.responseBody?.length).toBeLessThanOrEqual(1000);
  expect(sent).toHaveLength(6);
});

it("treats other client errors and redirects as permanent but retries 429", async () => {
  const endpoint = await createGeneric();
  await emit(taskData);
  await emit(taskData);
  await emit(taskData);
  const rows = await deliveriesFor(endpoint.id);
  const statuses = [404, 302, 429];
  const expected = ["dead", "dead", "retrying"];
  for (const [index, status] of statuses.entries()) {
    const { deps } = makeDeps(() => ({ bodySnippet: "", status }));
    // eslint-disable-next-line no-await-in-loop
    await deliver(rows[index]?.id ?? "", deps);
  }
  const after = await deliveriesFor(endpoint.id);
  expect(after.map(({ status }) => status)).toEqual(expected);
});

it("never connects to a private address, even when the name looks public", async () => {
  const endpoint = await createGeneric();
  await emit(taskData);
  const [delivery] = await deliveriesFor(endpoint.id);
  const blocked = [
    "127.0.0.1",
    "169.254.169.254",
    "10.1.2.3",
    "::1",
    "fd00::1",
  ];
  for (const address of blocked) {
    const { deps, sent } = makeDeps(() => ({ bodySnippet: "", status: 200 }), {
      resolve: resolvesTo(address, address.includes(":") ? 6 : 4),
    });
    // eslint-disable-next-line no-await-in-loop
    await deliver(delivery?.id ?? "", deps);
    expect(sent).toHaveLength(0);
    // eslint-disable-next-line no-await-in-loop
    const [row] = await deliveriesFor(endpoint.id);
    expect(row?.status).toBe("dead");
    expect(row?.responseCode).toBeNull();
    // Resetting lets the next address be tried.
    // eslint-disable-next-line no-await-in-loop
    await authPool.query(
      "UPDATE webhook_delivery SET status = 'pending', attempts = 0 WHERE id = $1",
      [delivery?.id]
    );
  }
});

it("re-checks the stored URL at delivery time", async () => {
  const endpoint = await createGeneric();
  await emit(taskData);
  const [delivery] = await deliveriesFor(endpoint.id);
  await authPool.query("UPDATE webhook_endpoint SET url = $2 WHERE id = $1", [
    endpoint.id,
    "http://receiver.example.com/in",
  ]);
  const { deps, sent } = makeDeps(() => ({ bodySnippet: "", status: 200 }));
  await deliver(delivery?.id ?? "", deps);
  expect(sent).toHaveLength(0);
  const [row] = await deliveriesFor(endpoint.id);
  expect(row?.status).toBe("dead");
});

it("retries when the host cannot be resolved or the connection fails", async () => {
  const endpoint = await createGeneric();
  await emit(taskData);
  const [delivery] = await deliveriesFor(endpoint.id);
  const unresolved = makeDeps(() => ({ bodySnippet: "", status: 200 }), {
    resolve: () => Promise.reject(new Error("ENOTFOUND")),
  });
  const unresolvedOutcome = await deliver(delivery?.id ?? "", unresolved.deps);
  expect(unresolvedOutcome._tag).toBe("Failure");
  const refused = makeDeps(() => new Error("ECONNREFUSED 10.9.9.9:443"));
  const refusedOutcome = await deliver(delivery?.id ?? "", refused.deps);
  expect(refusedOutcome._tag).toBe("Failure");
  const [row] = await deliveriesFor(endpoint.id);
  expect(row?.status).toBe("retrying");
  expect(row?.attempts).toBe(2);
  expect(row?.lastError).not.toContain("10.9.9.9");
});

it("sends Slack endpoints a plain text message without signature headers", async () => {
  const created = await manage((service) =>
    service.create(adminId, {
      events: ["task.created"],
      kind: "slack",
      name: "Slack",
      url: "https://hooks.slack.com/services/T000/B000/XXXXXXXX",
    })
  );
  await emit({ ...taskData, title: "Hello <!here>" });
  const [delivery] = await deliveriesFor(created.endpoint.id);
  const { deps, sent } = makeDeps(() => ({ bodySnippet: "ok", status: 200 }), {
    resolve: resolvesTo("54.230.1.1"),
  });
  const outcome = await deliver(delivery?.id ?? "", deps);
  expect(outcome._tag).toBe("Success");
  expect(JSON.parse(sent[0]?.body ?? "{}")).toEqual({
    text: "Task created: Hello &lt;!here&gt;",
  });
  expect(sent[0]?.headers["x-metsys-signature"]).toBeUndefined();
});

it("skips deliveries for a disabled endpoint", async () => {
  const endpoint = await createGeneric();
  await emit(taskData);
  const [delivery] = await deliveriesFor(endpoint.id);
  await manage((service) =>
    service.update(adminId, endpoint.id, {
      enabled: false,
      events: ["task.created"],
      name: "Receiver",
      url: "https://receiver.example.com/in",
    })
  );
  const { deps, sent } = makeDeps(() => ({ bodySnippet: "", status: 200 }));
  const outcome = await deliver(delivery?.id ?? "", deps);
  expect(outcome._tag).toBe("Success");
  expect(sent).toHaveLength(0);
});

it("lets an admin redeliver a dead delivery under a new job", async () => {
  const endpoint = await createGeneric();
  await emit(taskData);
  const [delivery] = await deliveriesFor(endpoint.id);
  const failing = makeDeps(() => ({ bodySnippet: "no", status: 404 }));
  await deliver(delivery?.id ?? "", failing.deps);
  const [afterFailure] = await deliveriesFor(endpoint.id);
  expect(afterFailure?.status).toBe("dead");

  const reset = await manage((service) =>
    service.redeliver(adminId, delivery?.id ?? "")
  );
  expect(reset).toMatchObject({ attempts: 0, status: "pending" });
  const jobs = await authPool.query(
    'SELECT id FROM job WHERE "dedupeKey" LIKE $1',
    [`webhook:${endpoint.id}:%`]
  );
  expect(jobs.rows).toHaveLength(2);

  const working = makeDeps(() => ({ bodySnippet: "ok", status: 200 }));
  await deliver(delivery?.id ?? "", working.deps);
  const [afterRetry] = await deliveriesFor(endpoint.id);
  expect(afterRetry?.status).toBe("succeeded");
  const listed = await manage((service) =>
    service.listDeliveries(adminId, endpoint.id, 10)
  );
  expect(listed).toHaveLength(1);
});
