import { and } from "@prisma/orm-postgres/orm-client";
import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { DeadJobSummary } from "./processor-contracts";

export const enqueueMaintenance = (
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

export const listDeadJobs = (
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
