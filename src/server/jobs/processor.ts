import { and, or } from "@prisma/orm-postgres/orm-client";
import { Cause, Context, Effect, Exit, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { JobHandlers } from "./job-handlers";
import type { JobHandlersApi, JsonValue } from "./job-handlers";

export interface JobLeasePolicy {
  readonly leaseDurationMs: number;
  readonly renewalIntervalMs: number;
}

const DEFAULT_JOB_LEASE_POLICY: JobLeasePolicy = {
  leaseDurationMs: 60_000,
  renewalIntervalMs: 20_000,
};

export interface ClaimedJob {
  readonly id: string;
  readonly kind: string;
  readonly payload: JsonValue;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly leaseToken: string;
}

export interface JobBatchResult {
  readonly claimed: number;
  readonly completed: number;
  readonly deadLettered: number;
  readonly retried: number;
}

export interface DeadJobSummary {
  readonly id: string;
  readonly kind: string;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly lastError: string | null;
  readonly createdAt: string;
  readonly deadAt: string | null;
}

export const DeadJobSummarySchema = Schema.Struct({
  attempts: Schema.Number,
  createdAt: Schema.String,
  deadAt: Schema.NullOr(Schema.String),
  id: Schema.String,
  kind: Schema.String,
  lastError: Schema.NullOr(Schema.String),
  maxAttempts: Schema.Number,
});

export const DeadJobListSchema = Schema.Array(DeadJobSummarySchema);

export class JobProcessor extends Context.Service<
  JobProcessor,
  {
    readonly enqueueMaintenance: (
      scheduledAt: Date
    ) => Effect.Effect<{ readonly jobId: string }, AppError>;
    readonly listDeadJobs: (
      actorId: string,
      limit: number
    ) => Effect.Effect<readonly DeadJobSummary[], AppError>;
    readonly processBatch: (
      workerId: string,
      limit: number
    ) => Effect.Effect<JobBatchResult, AppError>;
  }
>()("metsys/server/JobProcessor") {}

const errorMessage = (cause: Cause.Cause<AppError>): string => {
  const failure = Cause.findErrorOption(cause);
  if (failure._tag === "Some" && failure.value instanceof AppError) {
    return `Handler failed (${failure.value.code}).`;
  }
  return "Job handler failed unexpectedly.";
};

const isPermanentFailure = (cause: Cause.Cause<AppError>): boolean => {
  const failure = Cause.findErrorOption(cause);
  return (
    failure._tag === "Some" &&
    failure.value instanceof AppError &&
    ["NOT_FOUND", "VALIDATION_FAILED", "FORBIDDEN"].includes(failure.value.code)
  );
};

const claimJobs = async (
  workerId: string,
  limit: number,
  leaseDurationMs: number
): Promise<readonly ClaimedJob[]> => {
  const now = new Date();
  const candidates = await db.orm.public.Job.where((job) =>
    and(
      job.completedAt.isNull(),
      job.deadAt.isNull(),
      job.availableAt.lte(now),
      or(job.leasedUntil.isNull(), job.leasedUntil.lt(now))
    )
  )
    .orderBy((job) => job.availableAt.asc())
    .limit(limit)
    .all();
  const claimed = await Promise.all(
    candidates.map(async (job) => {
      const claimedAt = new Date();
      const leaseToken = crypto.randomUUID();
      const updated = await db.orm.public.Job.where((current) =>
        and(
          current.id.eq(job.id),
          current.attempts.eq(job.attempts),
          current.completedAt.isNull(),
          current.deadAt.isNull(),
          current.availableAt.lte(claimedAt),
          or(current.leasedUntil.isNull(), current.leasedUntil.lt(claimedAt))
        )
      ).updateAndCount({
        attempts: job.attempts + 1,
        leaseOwner: workerId,
        leaseToken,
        leasedUntil: new Date(claimedAt.getTime() + leaseDurationMs),
        updatedAt: claimedAt,
      });
      if (updated === 0) {
        return null;
      }
      const claimedJob = await db.orm.public.Job.where({
        id: job.id,
        leaseToken,
      }).first();
      return claimedJob
        ? {
            attempts: claimedJob.attempts,
            id: claimedJob.id,
            kind: claimedJob.kind,
            leaseToken,
            maxAttempts: claimedJob.maxAttempts,
            payload: claimedJob.payload,
          }
        : null;
    })
  );
  return claimed.filter((job): job is ClaimedJob => job !== null);
};

const renewJobLease = async (
  job: ClaimedJob,
  workerId: string,
  leaseDurationMs: number
): Promise<boolean> => {
  const now = new Date();
  const renewed = await db.orm.public.Job.where((current) =>
    and(
      current.completedAt.isNull(),
      current.id.eq(job.id),
      current.leaseOwner.eq(workerId),
      current.leaseToken.eq(job.leaseToken),
      current.leasedUntil.gt(now)
    )
  ).updateAndCount({
    leasedUntil: new Date(now.getTime() + leaseDurationMs),
    updatedAt: now,
  });
  return renewed > 0;
};

const runHandlerWithLease = async (
  job: ClaimedJob,
  workerId: string,
  handler: Effect.Effect<void, AppError>,
  leasePolicy: JobLeasePolicy
): Promise<{
  readonly exit: Exit.Exit<void, AppError>;
  readonly leaseLost: boolean;
}> => {
  let renewalInFlight = false;
  let leaseLost = false;
  let renewalPromise: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (renewalInFlight || leaseLost) {
      return;
    }
    renewalInFlight = true;
    renewalPromise = (async () => {
      try {
        const renewed = await renewJobLease(
          job,
          workerId,
          leasePolicy.leaseDurationMs
        );
        leaseLost = !renewed;
      } catch {
        leaseLost = true;
      } finally {
        renewalInFlight = false;
      }
    })();
  }, leasePolicy.renewalIntervalMs);
  try {
    const exit = await Effect.runPromiseExit(handler);
    clearInterval(timer);
    await renewalPromise;
    return { exit, leaseLost };
  } finally {
    clearInterval(timer);
  }
};

const finishJob = async (
  job: ClaimedJob,
  workerId: string
): Promise<boolean> => {
  const now = new Date();
  const finished = await db.orm.public.Job.where((current) =>
    and(
      current.completedAt.isNull(),
      current.id.eq(job.id),
      current.leaseOwner.eq(workerId),
      current.leaseToken.eq(job.leaseToken),
      current.leasedUntil.gte(now)
    )
  ).updateAndCount({
    completedAt: now,
    lastError: null,
    leaseOwner: null,
    leasedUntil: null,
    updatedAt: now,
  });
  return finished > 0;
};

const retryJob = async (
  job: ClaimedJob,
  workerId: string,
  reason: string,
  permanent: boolean
): Promise<boolean> => {
  const isDead = permanent || job.attempts >= job.maxAttempts;
  const delaySeconds = Math.min(3600, 2 ** Math.min(job.attempts, 11));
  const now = new Date();
  const retried = await db.orm.public.Job.where((current) =>
    and(
      current.completedAt.isNull(),
      current.id.eq(job.id),
      current.leaseOwner.eq(workerId),
      current.leaseToken.eq(job.leaseToken),
      current.leasedUntil.gte(now)
    )
  ).updateAndCount({
    ...(isDead
      ? {}
      : { availableAt: new Date(now.getTime() + delaySeconds * 1000) }),
    deadAt: isDead ? now : null,
    lastError: reason,
    leaseOwner: null,
    leasedUntil: null,
    updatedAt: now,
  });
  return retried > 0;
};

const workerIdSchema = Schema.String.check(
  Schema.makeFilter((workerId) =>
    workerId.trim().length > 0 && workerId.length <= 120
      ? undefined
      : "A valid worker identifier is required."
  )
);

const makeProcessBatch =
  (handlers: JobHandlersApi, leasePolicy: JobLeasePolicy) =>
  (
    workerId: string,
    requestedLimit: number
  ): Effect.Effect<JobBatchResult, AppError> =>
    Effect.tryPromise({
      catch: (error) =>
        error instanceof AppError
          ? error
          : new AppError({
              code: "UNAVAILABLE",
              message: "The background job processor is unavailable.",
            }),
      try: async () => {
        if (!Schema.is(workerIdSchema)(workerId)) {
          throw new AppError({
            code: "VALIDATION_FAILED",
            message: "A valid worker identifier is required.",
          });
        }
        const limit = Math.max(1, Math.min(25, Math.trunc(requestedLimit)));
        const jobs = await claimJobs(
          workerId.trim(),
          limit,
          leasePolicy.leaseDurationMs
        );
        const results = await Promise.all(
          jobs.map(async (job) => {
            const { exit, leaseLost } = await runHandlerWithLease(
              job,
              workerId.trim(),
              handlers.handle(job.kind, job.payload),
              leasePolicy
            );
            if (leaseLost) {
              return "lease-lost";
            }
            if (Exit.isSuccess(exit)) {
              return (await finishJob(job, workerId.trim()))
                ? "completed"
                : "lease-lost";
            }

            const permanent = isPermanentFailure(exit.cause);
            const retryScheduled = await retryJob(
              job,
              workerId.trim(),
              errorMessage(exit.cause),
              permanent
            );
            if (!retryScheduled) {
              return "lease-lost";
            }
            return permanent || job.attempts >= job.maxAttempts
              ? "dead-lettered"
              : "retried";
          })
        );

        return {
          claimed: jobs.length,
          completed: results.filter((result) => result === "completed").length,
          deadLettered: results.filter((result) => result === "dead-lettered")
            .length,
          retried: results.filter((result) => result === "retried").length,
        };
      },
    });

const enqueueMaintenance = (
  scheduledAt: Date
): Effect.Effect<{ readonly jobId: string }, AppError> =>
  Effect.tryPromise({
    catch: (error) =>
      error instanceof AppError
        ? error
        : new AppError({
            code: "UNAVAILABLE",
            message: "The maintenance job could not be scheduled.",
          }),
    try: async () => {
      if (!Number.isFinite(scheduledAt.getTime())) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "A valid schedule time is required.",
        });
      }
      const dayKey = scheduledAt.toISOString().slice(0, 10);
      const dedupeKey = `storage.cleanup-expired-uploads:${dayKey}`;
      const dueSummaryHour = scheduledAt.toISOString().slice(0, 13);
      const [job] = await Promise.all([
        db.orm.public.Job.upsert({
          conflictOn: { dedupeKey },
          create: {
            availableAt: scheduledAt,
            dedupeKey,
            id: crypto.randomUUID(),
            kind: "storage.cleanup-expired-uploads",
            payload: {},
            updatedAt: scheduledAt,
          },
          update: { updatedAt: scheduledAt },
        }),
        db.orm.public.Job.upsert({
          conflictOn: {
            dedupeKey: `notifications.daily-due-summary:${dueSummaryHour}`,
          },
          create: {
            availableAt: scheduledAt,
            dedupeKey: `notifications.daily-due-summary:${dueSummaryHour}`,
            id: crypto.randomUUID(),
            kind: "notifications.daily-due-summary",
            payload: { scheduledAt: scheduledAt.toISOString() },
            updatedAt: scheduledAt,
          },
          update: { updatedAt: scheduledAt },
        }),
      ]);
      return { jobId: job.id };
    },
  });

const listDeadJobs = (
  actorId: string,
  requestedLimit: number
): Effect.Effect<readonly DeadJobSummary[], AppError> =>
  Effect.tryPromise({
    catch: (error) =>
      error instanceof AppError
        ? error
        : new AppError({
            code: "UNAVAILABLE",
            message: "Failed jobs could not be loaded.",
          }),
    try: async () => {
      if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Choose a valid failed-job page size.",
        });
      }
      const actor = await db.orm.public.User.where({ id: actorId })
        .select("role", "deactivatedAt", "mustChangePassword")
        .first();
      if (!actor || actor.deactivatedAt) {
        throw new AppError({
          code: "UNAUTHENTICATED",
          message: "Sign in to continue.",
        });
      }
      if (actor.mustChangePassword || actor.role !== "admin") {
        throw new AppError({
          code: "FORBIDDEN",
          message: "Administrator access is required.",
        });
      }
      const jobs = await db.orm.public.Job.where((job) =>
        and(job.deadAt.isNotNull(), job.completedAt.isNull())
      )
        .orderBy((job) => job.deadAt.desc())
        .limit(Math.min(100, requestedLimit))
        .all();
      return jobs.map((job) => ({
        attempts: job.attempts,
        createdAt: job.createdAt.toISOString(),
        deadAt: job.deadAt?.toISOString() ?? null,
        id: job.id,
        kind: job.kind,
        lastError: job.lastError,
        maxAttempts: job.maxAttempts,
      }));
    },
  });

export const makeJobProcessorLayer = (
  leasePolicy: JobLeasePolicy = DEFAULT_JOB_LEASE_POLICY
) =>
  Layer.effect(
    JobProcessor,
    Effect.map(Effect.service(JobHandlers), (handlers) =>
      JobProcessor.of({
        enqueueMaintenance,
        listDeadJobs,
        processBatch: makeProcessBatch(handlers, leasePolicy),
      })
    )
  );

export const JobProcessorLive = makeJobProcessorLayer();
