import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";
import type { JsonValue } from "./job-handlers";

export interface JobLeasePolicy {
  readonly leaseDurationMs: number;
  readonly renewalIntervalMs: number;
}

export const DEFAULT_JOB_LEASE_POLICY: JobLeasePolicy = {
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
