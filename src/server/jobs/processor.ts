import { and, or } from "@prisma/orm-postgres/orm-client";
import { Cause, Context, Effect, Exit, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { JobHandlers } from "./job-handlers";
import type { JobHandlersApi, JsonValue } from "./job-handlers";

const JOB_CLOCK_SKEW_TOLERANCE_MS = 5000;

export interface ClaimedJob {
  readonly id: string;
  readonly kind: string;
  readonly payload: JsonValue;
  readonly attempts: number;
  readonly maxAttempts: number;
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
  limit: number
): Promise<readonly ClaimedJob[]> => {
  const now = new Date(Date.now() + JOB_CLOCK_SKEW_TOLERANCE_MS);
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
      const claimedAt = new Date(Date.now() + JOB_CLOCK_SKEW_TOLERANCE_MS);
      const updated = await db.orm.public.Job.where((current) =>
        and(
          current.id.eq(job.id),
          current.attempts.eq(job.attempts),
          current.completedAt.isNull(),
          current.deadAt.isNull(),
          current.availableAt.lte(claimedAt),
          or(current.leasedUntil.isNull(), current.leasedUntil.lt(claimedAt))
        )
      ).update({
        attempts: job.attempts + 1,
        leaseOwner: workerId,
        leasedUntil: new Date(claimedAt.getTime() + 60_000),
        updatedAt: claimedAt,
      });
      return updated
        ? {
            attempts: updated.attempts,
            id: updated.id,
            kind: updated.kind,
            maxAttempts: updated.maxAttempts,
            payload: updated.payload,
          }
        : null;
    })
  );
  return claimed.filter((job): job is ClaimedJob => job !== null);
};

const finishJob = async (
  job: ClaimedJob,
  workerId: string
): Promise<boolean> => {
  const now = new Date();
  const finished = await db.orm.public.Job.where({
    completedAt: null,
    id: job.id,
    leaseOwner: workerId,
  }).updateAndCount({
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
): Promise<void> => {
  const isDead = permanent || job.attempts >= job.maxAttempts;
  const delaySeconds = Math.min(3600, 2 ** Math.min(job.attempts, 11));
  const now = new Date();
  await db.orm.public.Job.where({
    completedAt: null,
    id: job.id,
    leaseOwner: workerId,
  }).updateAndCount({
    ...(isDead
      ? {}
      : { availableAt: new Date(now.getTime() + delaySeconds * 1000) }),
    deadAt: isDead ? now : null,
    lastError: reason,
    leaseOwner: null,
    leasedUntil: null,
    updatedAt: now,
  });
};

const workerIdSchema = Schema.String.check(
  Schema.makeFilter((workerId) =>
    workerId.trim().length > 0 && workerId.length <= 120
      ? undefined
      : "A valid worker identifier is required."
  )
);

const makeProcessBatch =
  (handlers: JobHandlersApi) =>
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
        const jobs = await claimJobs(workerId.trim(), limit);
        const results = await Promise.all(
          jobs.map(async (job) => {
            const exit = await Effect.runPromiseExit(
              handlers.handle(job.kind, job.payload)
            );
            if (Exit.isSuccess(exit)) {
              return (await finishJob(job, workerId.trim()))
                ? "completed"
                : "lease-lost";
            }

            const permanent = isPermanentFailure(exit.cause);
            await retryJob(
              job,
              workerId.trim(),
              errorMessage(exit.cause),
              permanent
            );
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

export const JobProcessorLive = Layer.effect(
  JobProcessor,
  Effect.map(Effect.service(JobHandlers), (handlers) =>
    JobProcessor.of({
      enqueueMaintenance,
      listDeadJobs,
      processBatch: makeProcessBatch(handlers),
    })
  )
);
