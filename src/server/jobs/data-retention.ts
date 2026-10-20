import { Effect, pipe, Record as EffectRecord } from "effect";

import { authPool } from "../auth/database";
import { AppError } from "../core/action-result";
import { parseRetentionEnv } from "../core/env";
import { logger } from "../core/logger";

// Audit events (`audit_event`) are deliberately NOT purged here. They are the
// security and compliance record of who did what; removing or archiving them
// needs an explicit retention decision (legal hold, export first), not a
// housekeeping job.

export const DATA_RETENTION_JOB = "maintenance.purge-expired-data";

const DAY_MS = 86_400_000;
// Each statement removes at most this many rows, so a large backlog is
// cleared in short transactions that never hold long table locks.
const DEFAULT_BATCH_SIZE = 5000;
// Better Auth rate-limit windows are at most a minute; a day-old counter is
// dead weight.
const RATE_LIMIT_STALE_DAYS = 1;

export interface RetentionPolicy {
  readonly completedJobDays: number;
  readonly deadJobDays: number;
  readonly pushDeliveryDays: number;
}

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  completedJobDays: 14,
  deadJobDays: 30,
  pushDeliveryDays: 30,
};

export const retentionPolicyFromEnv = (
  source: Readonly<Record<string, string | undefined>> = process.env
): RetentionPolicy => {
  const env = parseRetentionEnv(source);
  return {
    completedJobDays:
      env.RETENTION_COMPLETED_JOB_DAYS ??
      DEFAULT_RETENTION_POLICY.completedJobDays,
    deadJobDays:
      env.RETENTION_DEAD_JOB_DAYS ?? DEFAULT_RETENTION_POLICY.deadJobDays,
    pushDeliveryDays:
      env.RETENTION_PUSH_DELIVERY_DAYS ??
      DEFAULT_RETENTION_POLICY.pushDeliveryDays,
  };
};

interface RetentionTarget {
  readonly table: string;
  readonly key: string;
  // Compared against the cutoff bound as $1.
  readonly predicate: string;
  readonly cutoff: (now: Date, policy: RetentionPolicy) => Date | number;
}

const before = (now: Date, days: number): Date =>
  new Date(now.getTime() - days * DAY_MS);

const retentionTargets = {
  completedJobs: {
    cutoff: (now, policy) => before(now, policy.completedJobDays),
    key: "id",
    predicate: '"completedAt" < $1',
    table: "job",
  },
  deadJobs: {
    cutoff: (now, policy) => before(now, policy.deadJobDays),
    key: "id",
    predicate: '"completedAt" IS NULL AND "deadAt" < $1',
    table: "job",
  },
  idempotencyKeys: {
    cutoff: (now) => now,
    key: "id",
    predicate: '"expiresAt" < $1',
    table: "idempotency_key",
  },
  pushDeliveries: {
    cutoff: (now, policy) => before(now, policy.pushDeliveryDays),
    key: "id",
    predicate: '"deliveredAt" < $1',
    table: "push_delivery",
  },
  // `lastRequest` holds epoch milliseconds.
  rateLimits: {
    cutoff: (now) => before(now, RATE_LIMIT_STALE_DAYS).getTime(),
    key: "key",
    predicate: '"lastRequest" < $1',
    table: "rateLimit",
  },
  sessions: {
    cutoff: (now) => now,
    key: "id",
    predicate: '"expiresAt" < $1',
    table: "session",
  },
  verifications: {
    cutoff: (now) => now,
    key: "id",
    predicate: '"expiresAt" < $1',
    table: "verification",
  },
} as const satisfies Record<string, RetentionTarget>;

export type RetentionReport = {
  readonly [Name in keyof typeof retentionTargets]: number;
};

// The predicate is repeated on the outer DELETE so a row refreshed between
// the key lookup and the delete (an idempotency key reused, say) survives.
const deleteBatch = async (
  target: RetentionTarget,
  cutoff: Date | number,
  batchSize: number
): Promise<number> => {
  const result = await authPool.query(
    `DELETE FROM "${target.table}" WHERE "${target.key}" IN (SELECT "${target.key}" FROM "${target.table}" WHERE ${target.predicate} LIMIT $2) AND ${target.predicate}`,
    [cutoff, batchSize]
  );
  return result.rowCount ?? 0;
};

const purgeTarget = (
  target: RetentionTarget,
  cutoff: Date | number,
  batchSize: number
): Effect.Effect<number, AppError> =>
  Effect.gen(function* purgeInBatches() {
    let purged = 0;
    for (;;) {
      const deleted = yield* Effect.tryPromise({
        catch: (error) => {
          logger.error("A data-retention batch failed.", {
            error,
            table: target.table,
          });
          return new AppError({
            code: "UNAVAILABLE",
            message: "Expired data could not be purged.",
          });
        },
        try: () => deleteBatch(target, cutoff, batchSize),
      });
      purged += deleted;
      if (deleted < batchSize) {
        return purged;
      }
    }
  });

export interface PurgeOptions {
  readonly now: Date;
  readonly batchSize?: number;
  readonly policy?: RetentionPolicy;
}

/** Deletes rows past their retention window, one table at a time. */
export const purgeExpiredData = (
  options: PurgeOptions
): Effect.Effect<RetentionReport, AppError> =>
  Effect.gen(function* purgeExpired() {
    const policy = options.policy ?? retentionPolicyFromEnv();
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    const purges = pipe(
      retentionTargets,
      EffectRecord.map((target: RetentionTarget) =>
        purgeTarget(target, target.cutoff(options.now, policy), batchSize)
      )
    );
    // One table at a time keeps the purge's load on the database flat.
    const report: RetentionReport = yield* Effect.all(purges, {
      concurrency: 1,
    });
    logger.info("Expired data purged.", { purged: report });
    return report;
  });
