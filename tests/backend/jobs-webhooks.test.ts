import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { db } from "../../src/prisma/db";
import { authPool } from "../../src/server/auth/database";
import { JobHandlersLive } from "../../src/server/jobs/job-handlers-live";
import {
  JobProcessor,
  JobProcessorLive,
} from "../../src/server/jobs/processor";
import { PushTransport } from "../../src/server/notifications/push-transport";
import { Storage } from "../../src/server/storage/storage";
import { enqueueWebhookEvent } from "../../src/server/webhooks/webhook-enqueue";
import {
  WebhookManagement,
  WebhookManagementLive,
} from "../../src/server/webhooks/webhook-management";

process.env["BETTER_AUTH_SECRET"] ??=
  "test-only-secret-that-is-at-least-thirty-two-characters";

const storageLayer = Layer.succeed(
  Storage,
  Storage.of({
    copyObject: () => Effect.void,
    deleteObject: () => Effect.void,
    signDownload: () => Effect.succeed("https://private.example/download"),
    signPreview: () => Effect.succeed("https://private.example/preview"),
    signUpload: () => Effect.succeed("https://private.example/upload"),
    verifyObject: () => Effect.void,
  })
);
const pushLayer = Layer.succeed(
  PushTransport,
  PushTransport.of({ send: () => Effect.succeed("delivered") })
);
const processorLayer = Layer.provide(
  JobProcessorLive,
  Layer.provide(JobHandlersLive, Layer.merge(storageLayer, pushLayer))
);

const domain = "jobs-webhooks.example";
const adminId = randomUUID();

beforeAll(async () => {
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, $4, false)',
    [adminId, "Jobs Admin", `${adminId}@${domain}`, "admin"]
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

const processOne = (workerId: string) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* processBatch() {
        const processor = yield* JobProcessor;
        return yield* processor.processBatch(workerId, 25);
      }),
      processorLayer
    )
  );

it("runs the webhook delivery job and dead-letters an SSRF target at once", async () => {
  const created = await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* create() {
        const service = yield* WebhookManagement;
        return yield* service.create(adminId, {
          events: ["task.created"],
          kind: "generic",
          name: "Worker target",
          url: "https://receiver.example.com/in",
        });
      }),
      WebhookManagementLive
    )
  );
  // A stored row can be edited or poisoned after validation; the worker must
  // refuse it again when it runs.
  await authPool.query("UPDATE webhook_endpoint SET url = $2 WHERE id = $1", [
    created.endpoint.id,
    "https://169.254.169.254/latest/meta-data/",
  ]);
  await db.transaction((transaction) =>
    enqueueWebhookEvent(transaction, "task.created", {
      data: { id: "task-1", title: "Pinned" },
      now: new Date(Date.now() - 1000),
    })
  );

  const result = await processOne(`webhook-worker-${randomUUID()}`);
  expect(result.claimed).toBeGreaterThanOrEqual(1);
  expect(result.deadLettered).toBeGreaterThanOrEqual(1);

  const delivery = await authPool.query<{
    status: string;
    responseCode: number | null;
  }>(
    'SELECT status, "responseCode" FROM webhook_delivery WHERE "endpointId" = $1',
    [created.endpoint.id]
  );
  expect(delivery.rows[0]).toMatchObject({
    responseCode: null,
    status: "dead",
  });
  const job = await authPool.query<{ deadAt: Date | null }>(
    'SELECT "deadAt" FROM job WHERE "dedupeKey" LIKE $1',
    [`webhook:${created.endpoint.id}:%`]
  );
  expect(job.rows[0]?.deadAt).not.toBeNull();
});
