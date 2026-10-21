import { expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import { JobHandlers } from "../../src/server/jobs/job-handlers";
import { JobHandlersLive } from "../../src/server/jobs/job-handlers-live";
import {
  JobProcessor,
  JobProcessorLive,
} from "../../src/server/jobs/processor";
import { PushTransport } from "../../src/server/notifications/push-transport";
import { Storage } from "../../src/server/storage/storage";

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

const processOne = (workerId: string) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* processBatch() {
        const processor = yield* JobProcessor;
        return yield* processor.processBatch(workerId, 1);
      }),
      processorLayer
    )
  );

it("runs the email delivery job registered with the worker", async () => {
  const userId = randomUUID();
  const jobId = randomUUID();
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [userId, "Mail Job", `${userId}@jobs-email.example`]
  );
  await authPool.query(
    "INSERT INTO notification_preference (id, \"userId\", channel, \"eventType\", enabled) VALUES ($1, $2, 'email', 'comment', true)",
    [randomUUID(), userId]
  );
  await authPool.query(
    'INSERT INTO job (id, kind, payload, "dedupeKey", "availableAt") VALUES ($1, $2, $3::json, $4, now() - interval \'1 second\')',
    [
      jobId,
      "notifications.deliver-email",
      JSON.stringify({
        body: "Looks good",
        eventType: "comment",
        notificationId: randomUUID(),
        title: "New comment",
        url: "/tasks/7",
        userId,
      }),
      `email:${jobId}`,
    ]
  );

  try {
    const result = await processOne(`email-worker-${jobId}`);

    expect(result.completed).toBe(1);
    expect(result.deadLettered).toBe(0);
  } finally {
    await authPool.query("DELETE FROM job WHERE id = $1", [jobId]);
    await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  }
});

it("rejects an email job whose link leaves the app", async () => {
  const jobId = randomUUID();
  await authPool.query(
    'INSERT INTO job (id, kind, payload, "dedupeKey", "availableAt", "maxAttempts") VALUES ($1, $2, $3::json, $4, now() - interval \'1 second\', 1)',
    [
      jobId,
      "notifications.deliver-email",
      JSON.stringify({
        body: "",
        eventType: "comment",
        notificationId: randomUUID(),
        title: "Phish",
        url: "//evil.example/login",
        userId: "nobody",
      }),
      `email:${jobId}`,
    ]
  );

  try {
    const result = await processOne(`email-bad-worker-${jobId}`);

    expect(result.completed).toBe(0);
  } finally {
    await authPool.query("DELETE FROM job WHERE id = $1", [jobId]);
  }
});

it("schedules one email digest scan per hour with the maintenance run", async () => {
  const scheduledAt = new Date("2099-04-02T08:00:00.000Z");
  const noHandlers = Layer.succeed(
    JobHandlers,
    JobHandlers.of({ handle: () => Effect.void })
  );

  try {
    await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* schedule() {
          const processor = yield* JobProcessor;
          yield* processor.enqueueMaintenance(scheduledAt);
          yield* processor.enqueueMaintenance(scheduledAt);
        }),
        Layer.provide(JobProcessorLive, noHandlers)
      )
    );
    const jobs = await authPool.query(
      "SELECT \"dedupeKey\" FROM job WHERE kind = 'notifications.email-digest' AND \"dedupeKey\" LIKE '%2099-04-02%'"
    );

    expect(jobs.rows).toEqual([
      { dedupeKey: "notifications.email-digest:2099-04-02T08" },
    ]);
  } finally {
    await authPool.query(
      'DELETE FROM job WHERE "dedupeKey" LIKE $1 OR ("dedupeKey" LIKE \'bug.sla_sweep:%\' AND "availableAt" = $2)',
      ["%2099-04-02%", scheduledAt]
    );
  }
});
