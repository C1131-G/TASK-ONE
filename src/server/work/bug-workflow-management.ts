import { Context, Effect, Layer } from "effect";

import { db } from "@/src/prisma/db";

import type { AppError } from "../core/action-result";
import type {
  BugApprovalDecisionInput,
  BugEvidenceInput,
  BugFixAttemptInput,
  BugPostReleaseCheckInput,
  BugRelationInput,
  BugReleaseInput,
  BugSubmitApprovalInput,
  BugTriageInput,
  BugVerificationInput,
  BugVersionInput,
} from "./bug-contracts";
import { archiveBug, reopenBug, restoreBug } from "./bug-workflow-admin";
import { decideApproval, submitApproval } from "./bug-workflow-approval";
import type { BugWorkflowReceipt } from "./bug-workflow-internal";
import {
  addEvidence,
  addFixAttempt,
  recordVerification,
} from "./bug-workflow-investigation";
import { postReleaseCheck, recordRelease } from "./bug-workflow-release";
import { addBugRelation, triageBug } from "./bug-workflow-triage";
import type { Transaction } from "./work-internal";
import { databaseError } from "./work-internal";

export { BugWorkflowReceiptSchema } from "./bug-workflow-internal";
export type { BugWorkflowReceipt } from "./bug-workflow-internal";
const run = <Input, Output>(
  actorId: string,
  input: Input,
  operation: (
    transaction: Transaction,
    actorId: string,
    input: Input
  ) => Promise<Output>
): Effect.Effect<Output, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () =>
      db.transaction((transaction) => operation(transaction, actorId, input)),
  });

export class BugWorkflowManagement extends Context.Service<
  BugWorkflowManagement,
  {
    readonly triage: (
      actorId: string,
      input: BugTriageInput
    ) => Effect.Effect<BugWorkflowReceipt, AppError>;
    readonly relate: (
      actorId: string,
      input: BugRelationInput
    ) => Effect.Effect<BugWorkflowReceipt, AppError>;
    readonly addFixAttempt: (
      actorId: string,
      input: BugFixAttemptInput
    ) => Effect.Effect<BugWorkflowReceipt, AppError>;
    readonly addEvidence: (
      actorId: string,
      input: BugEvidenceInput
    ) => Effect.Effect<BugWorkflowReceipt, AppError>;
    readonly verifyFix: (
      actorId: string,
      input: BugVerificationInput
    ) => Effect.Effect<BugWorkflowReceipt, AppError>;
    readonly submitApproval: (
      actorId: string,
      input: BugSubmitApprovalInput
    ) => Effect.Effect<BugWorkflowReceipt, AppError>;
    readonly decideApproval: (
      actorId: string,
      input: BugApprovalDecisionInput
    ) => Effect.Effect<BugWorkflowReceipt, AppError>;
    readonly recordRelease: (
      actorId: string,
      input: BugReleaseInput
    ) => Effect.Effect<BugWorkflowReceipt, AppError>;
    readonly postReleaseCheck: (
      actorId: string,
      input: BugPostReleaseCheckInput
    ) => Effect.Effect<BugWorkflowReceipt, AppError>;
    readonly archive: (
      actorId: string,
      input: BugVersionInput
    ) => Effect.Effect<BugWorkflowReceipt, AppError>;
    readonly restore: (
      actorId: string,
      input: BugVersionInput
    ) => Effect.Effect<BugWorkflowReceipt, AppError>;
    readonly reopen: (
      actorId: string,
      input: BugVersionInput
    ) => Effect.Effect<BugWorkflowReceipt, AppError>;
  }
>()("metsys/server/BugWorkflowManagement") {}

const operation =
  <Input, Output>(
    task: (
      transaction: Transaction,
      actorId: string,
      input: Input
    ) => Promise<Output>
  ) =>
  (actorId: string, input: Input): Effect.Effect<Output, AppError> =>
    run(actorId, input, task);

export const BugWorkflowManagementLive = Layer.succeed(
  BugWorkflowManagement,
  BugWorkflowManagement.of({
    addEvidence: operation(addEvidence),
    addFixAttempt: operation(addFixAttempt),
    archive: operation(archiveBug),
    decideApproval: operation(decideApproval),
    postReleaseCheck: operation(postReleaseCheck),
    recordRelease: operation(recordRelease),
    relate: operation(addBugRelation),
    reopen: operation(reopenBug),
    restore: operation(restoreBug),
    submitApproval: operation(submitApproval),
    triage: operation(triageBug),
    verifyFix: operation(recordVerification),
  })
);
