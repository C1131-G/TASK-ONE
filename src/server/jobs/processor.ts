import { Effect, Layer } from "effect";

import { JobHandlers } from "./job-handlers";
import { DEFAULT_JOB_LEASE_POLICY, JobProcessor } from "./processor-contracts";
import { makeProcessBatch } from "./processor-execution";
import { enqueueMaintenance, listDeadJobs } from "./processor-maintenance";

export {
  DeadJobListSchema,
  DeadJobSummarySchema,
  JobProcessor,
} from "./processor-contracts";
export type {
  ClaimedJob,
  DeadJobSummary,
  JobBatchResult,
  JobLeasePolicy,
} from "./processor-contracts";

export const makeJobProcessorLayer = (leasePolicy = DEFAULT_JOB_LEASE_POLICY) =>
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
