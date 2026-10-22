import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Layer } from "effect";

import { authPool } from "../../src/server/auth/database";
import {
  DATA_RETENTION_JOB,
  purgeExpiredData,
} from "../../src/server/jobs/data-retention";
import { JobHandlers } from "../../src/server/jobs/job-handlers";
import { JobHandlersLive } from "../../src/server/jobs/job-handlers-live";
import {
  JobProcessor,
  JobProcessorLive,
} from "../../src/server/jobs/processor";
import { PushTransport } from "../../src/server/notifications/push-transport";
import { Storage } from "../../src/server/storage/storage";

const DAY_MS = 86_400_000;
const unused = () => Effect.die(new Error("Storage is not used here."));
const now = new Date();
const daysAgo = (days: number): Date => new Date(now.getTime() - days * DAY_MS);

const userId = randomUUID();
const ids = {
  deadJobNew: randomUUID(),
  deadJobOld: randomUUID(),
  doneJobNew: randomUUID(),
  doneJobsOld: [randomUUID(), randomUUID(), randomUUID()],
  idempotencyLive: randomUUID(),
  idempotencyOld: randomUUID(),
  pendingJobOld: randomUUID(),
  pushNew: randomUUID(),
  pushOld: randomUUID(),
  rateLimitFresh: `retention-fresh-${userId}`,
  rateLimitStale: `retention-stale-${userId}`,
  sessionLive: randomUUID(),
  sessionOld: randomUUID(),
  verificationLive: randomUUID(),
  verificationOld: randomUUID(),
};

const insertJob = async (
  id: string,
  fields: { completedAt?: Date; deadAt?: Date; createdAt: Date }
) => {
  await authPool.query(
    'INSERT INTO job (id, kind, payload, "dedupeKey", "availableAt", "completedAt", "deadAt", "createdAt", "updatedAt") VALUES ($1, \'test.retention\', \'{}\'::json, $2, $3, $4, $5, $3, $3)',
    [
      id,
      `retention-${id}`,
      fields.createdAt,
      fields.completedAt ?? null,
      fields.deadAt ?? null,
    ]
  );
};

const seed = async () => {
  await authPool.query(
    'INSERT INTO "user" (id, name, email, "emailNormalized", role, "mustChangePassword") VALUES ($1, $2, $3, $3, \'employee\', false)',
    [userId, "Retention Tester", `${userId}@retention-test.example`]
  );
  await Promise.all([
    ...ids.doneJobsOld.map((id) =>
      insertJob(id, { completedAt: daysAgo(15), createdAt: daysAgo(16) })
    ),
    insertJob(ids.doneJobNew, {
      completedAt: daysAgo(13),
      createdAt: daysAgo(13),
    }),
    insertJob(ids.deadJobOld, { createdAt: daysAgo(40), deadAt: daysAgo(31) }),
    insertJob(ids.deadJobNew, { createdAt: daysAgo(40), deadAt: daysAgo(29) }),
    // Old but still pending work is never purged.
    insertJob(ids.pendingJobOld, { createdAt: daysAgo(90) }),
  ]);
  await authPool.query(
    "INSERT INTO idempotency_key (id, \"actorId\", key, \"requestHash\", \"expiresAt\") VALUES ($1, $3, 'old', 'h', $4), ($2, $3, 'live', 'h', $5)",
    [
      ids.idempotencyOld,
      ids.idempotencyLive,
      userId,
      daysAgo(1),
      new Date(now.getTime() + DAY_MS),
    ]
  );
  await authPool.query(
    'INSERT INTO session (id, token, "userId", "expiresAt") VALUES ($1, $1, $3, $4), ($2, $2, $3, $5)',
    [
      ids.sessionOld,
      ids.sessionLive,
      userId,
      daysAgo(1),
      new Date(now.getTime() + DAY_MS),
    ]
  );
  await authPool.query(
    "INSERT INTO verification (id, identifier, value, \"expiresAt\") VALUES ($1, $3, 'v', $4), ($2, $3, 'v', $5)",
    [
      ids.verificationOld,
      ids.verificationLive,
      `retention-${userId}`,
      daysAgo(1),
      new Date(now.getTime() + DAY_MS),
    ]
  );
  await authPool.query(
    'INSERT INTO "rateLimit" (key, count, "lastRequest") VALUES ($1, 1, $3), ($2, 1, $4)',
    [
      ids.rateLimitStale,
      ids.rateLimitFresh,
      daysAgo(2).getTime(),
      now.getTime(),
    ]
  );
  await authPool.query(
    'INSERT INTO push_delivery (id, "notificationId", "userId", "endpointHash", "deliveredAt", "createdAt") VALUES ($1, $1, $3, \'e\', $4, $4), ($2, $2, $3, \'e\', $5, $5)',
    [ids.pushOld, ids.pushNew, userId, daysAgo(31), daysAgo(29)]
  );
};

const cleanup = async () => {
  const jobIds = [
    ...ids.doneJobsOld,
    ids.doneJobNew,
    ids.deadJobOld,
    ids.deadJobNew,
    ids.pendingJobOld,
  ];
  await authPool.query("DELETE FROM job WHERE id = ANY($1::uuid[])", [jobIds]);
  await authPool.query('DELETE FROM idempotency_key WHERE "actorId" = $1', [
    userId,
  ]);
  await authPool.query('DELETE FROM session WHERE "userId" = $1', [userId]);
  await authPool.query("DELETE FROM verification WHERE identifier = $1", [
    `retention-${userId}`,
  ]);
  await authPool.query('DELETE FROM "rateLimit" WHERE key = ANY($1)', [
    [ids.rateLimitStale, ids.rateLimitFresh],
  ]);
  await authPool.query('DELETE FROM push_delivery WHERE "userId" = $1', [
    userId,
  ]);
  await authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
};

const existing = async (table: string, column: string, values: string[]) => {
  const result = await authPool.query<{ value: string }>(
    `SELECT "${column}"::text AS value FROM "${table}" WHERE "${column}"::text = ANY($1)`,
    [values]
  );
  return result.rows.map(({ value }) => value).toSorted();
};

const remainingRows = async () => ({
  idempotency: await existing("idempotency_key", "id", [
    ids.idempotencyOld,
    ids.idempotencyLive,
  ]),
  jobs: await existing("job", "id", [
    ...ids.doneJobsOld,
    ids.doneJobNew,
    ids.deadJobOld,
    ids.deadJobNew,
    ids.pendingJobOld,
  ]),
  push: await existing("push_delivery", "id", [ids.pushOld, ids.pushNew]),
  rateLimit: await existing("rateLimit", "key", [
    ids.rateLimitStale,
    ids.rateLimitFresh,
  ]),
  sessions: await existing("session", "id", [ids.sessionOld, ids.sessionLive]),
  verification: await existing("verification", "id", [
    ids.verificationOld,
    ids.verificationLive,
  ]),
});

const expectedRemaining = {
  idempotency: [ids.idempotencyLive],
  jobs: [ids.doneJobNew, ids.deadJobNew, ids.pendingJobOld].toSorted(),
  push: [ids.pushNew],
  rateLimit: [ids.rateLimitFresh],
  sessions: [ids.sessionLive],
  verification: [ids.verificationLive],
};

beforeAll(seed);
afterAll(cleanup);

it("purges only rows past their retention window, in small batches", async () => {
  const report = await Effect.runPromise(
    purgeExpiredData({ batchSize: 2, now })
  );

  expect(await remainingRows()).toEqual(expectedRemaining);
  expect(report.completedJobs).toBeGreaterThanOrEqual(3);
  expect(report.deadJobs).toBeGreaterThanOrEqual(1);
  expect(report.idempotencyKeys).toBeGreaterThanOrEqual(1);
  expect(report.sessions).toBeGreaterThanOrEqual(1);
  expect(report.verifications).toBeGreaterThanOrEqual(1);
  expect(report.rateLimits).toBeGreaterThanOrEqual(1);
  expect(report.pushDeliveries).toBeGreaterThanOrEqual(1);
});

it("is idempotent when the purge runs again", async () => {
  const report = await Effect.runPromise(purgeExpiredData({ now }));

  expect(await remainingRows()).toEqual(expectedRemaining);
  expect(report).toEqual({
    automationRuns: 0,
    completedJobs: 0,
    deadJobs: 0,
    githubDeliveries: 0,
    idempotencyKeys: 0,
    pushDeliveries: 0,
    rateLimits: 0,
    sessions: 0,
    verifications: 0,
    webhookDeliveries: 0,
  });
});

it("schedules the retention purge once per day with maintenance", async () => {
  const scheduledAt = new Date("2099-04-02T09:00:00.000Z");
  const handlerLayer = Layer.succeed(
    JobHandlers,
    JobHandlers.of({ handle: () => Effect.void })
  );
  const program = Effect.gen(function* program() {
    const processor = yield* JobProcessor;
    yield* processor.enqueueMaintenance(scheduledAt);
    yield* processor.enqueueMaintenance(new Date("2099-04-02T15:00:00.000Z"));
  });

  try {
    await Effect.runPromise(
      Effect.provide(program, Layer.provide(JobProcessorLive, handlerLayer))
    );
    const jobs = await authPool.query<{ kind: string }>(
      'SELECT kind FROM job WHERE "dedupeKey" LIKE $1',
      [`${DATA_RETENTION_JOB}:%2099-04-02%`]
    );
    expect(jobs.rows).toEqual([{ kind: DATA_RETENTION_JOB }]);
  } finally {
    await authPool.query(
      'DELETE FROM job WHERE "dedupeKey" LIKE $1 OR ("dedupeKey" LIKE \'bug.sla_sweep:%\' AND "availableAt" >= $2 AND "availableAt" < $3)',
      [
        "%2099-04-02%",
        new Date("2099-04-02T00:00:00.000Z"),
        new Date("2099-04-03T00:00:00.000Z"),
      ]
    );
  }
});

it("runs the retention purge when the worker claims its job", async () => {
  const id = randomUUID();
  // Older than every seeded job, so the worker claims this one first.
  await authPool.query(
    "INSERT INTO job (id, kind, payload, \"dedupeKey\", \"availableAt\") VALUES ($1, $2, '{}'::json, $3, '2000-01-01')",
    [id, DATA_RETENTION_JOB, `${DATA_RETENTION_JOB}:test-${id}`]
  );
  const dependencies = Layer.merge(
    Layer.succeed(
      Storage,
      Storage.of({
        copyObject: unused,
        deleteObject: unused,
        signDownload: unused,
        signPreview: unused,
        signUpload: unused,
        verifyObject: unused,
      })
    ),
    Layer.succeed(
      PushTransport,
      PushTransport.of({ send: () => Effect.succeed("delivered") })
    )
  );
  const program = Effect.gen(function* program() {
    const processor = yield* JobProcessor;
    return yield* processor.processBatch(`retention-worker-${id}`, 1);
  });

  try {
    const result = await Effect.runPromise(
      Effect.provide(
        program,
        Layer.provide(
          JobProcessorLive,
          Layer.provide(JobHandlersLive, dependencies)
        )
      )
    );

    expect(result).toEqual({
      claimed: 1,
      completed: 1,
      deadLettered: 0,
      retried: 0,
    });
  } finally {
    await authPool.query("DELETE FROM job WHERE id = $1", [id]);
  }
});
