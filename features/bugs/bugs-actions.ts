"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import { IdempotencyKeySchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  BugApprovalDecisionInputSchema,
  BugEvidenceInputSchema,
  BugFixAttemptInputSchema,
  BugPostReleaseCheckInputSchema,
  BugRelationInputSchema,
  BugReleaseInputSchema,
  BugReportInputSchema,
  BugSubmitApprovalInputSchema,
  BugTriageInputSchema,
  BugVerificationInputSchema,
  BugVersionInputSchema,
} from "@/src/server/work/bug-contracts";
import {
  BugManagement,
  BugManagementLive,
  BugReportItemSchema,
} from "@/src/server/work/bug-management";
import { BugWorkflowManagement } from "@/src/server/work/bug-workflow-management";

import {
  revalidateBugViews,
  runBugWorkflowAction,
} from "./actions/bug-workflow-runner";
import { getBugHistory, listBugs } from "./bugs-queries";

// Bug history and similar-bug search are read from client components.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function getBugHistoryAction(input: unknown) {
  return await getBugHistory(input);
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listBugsAction(input: unknown) {
  return await listBugs(input);
}

const ReportBugActionInputSchema = Schema.Struct({
  ...BugReportInputSchema.fields,
  idempotencyKey: IdempotencyKeySchema,
});

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function reportBugAction(input: unknown) {
  const result = await runServerAction(
    input,
    ReportBugActionInputSchema,
    (validated) =>
      Effect.gen(function* reportBug() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const bugs = yield* BugManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...reportInput } = validated;
        return yield* idempotency.run({
          actorId: actor.id,
          execute: () => bugs.reportBug(actor.id, reportInput),
          input: reportInput,
          key: idempotencyKey,
          operation: "bug.report",
          resultSchema: BugReportItemSchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(BugManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    BugReportItemSchema
  );
  if (result.ok) {
    revalidatePath("/bugs");
    revalidatePath(`/projects/${result.data.projectId}`);
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function triageBugAction(input: unknown) {
  return revalidateBugViews(
    await runBugWorkflowAction(input, BugTriageInputSchema, (actorId, value) =>
      Effect.gen(function* triage() {
        const service = yield* BugWorkflowManagement;
        return yield* service.triage(actorId, value);
      })
    )
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function relateBugAction(input: unknown) {
  return revalidateBugViews(
    await runBugWorkflowAction(
      input,
      BugRelationInputSchema,
      (actorId, value) =>
        Effect.gen(function* relate() {
          const service = yield* BugWorkflowManagement;
          return yield* service.relate(actorId, value);
        })
    )
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function addBugFixAttemptAction(input: unknown) {
  return revalidateBugViews(
    await runBugWorkflowAction(
      input,
      BugFixAttemptInputSchema,
      (actorId, value) =>
        Effect.gen(function* addFixAttempt() {
          const service = yield* BugWorkflowManagement;
          return yield* service.addFixAttempt(actorId, value);
        })
    )
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function addBugEvidenceAction(input: unknown) {
  return revalidateBugViews(
    await runBugWorkflowAction(
      input,
      BugEvidenceInputSchema,
      (actorId, value) =>
        Effect.gen(function* addEvidence() {
          const service = yield* BugWorkflowManagement;
          return yield* service.addEvidence(actorId, value);
        })
    )
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function verifyBugFixAction(input: unknown) {
  return revalidateBugViews(
    await runBugWorkflowAction(
      input,
      BugVerificationInputSchema,
      (actorId, value) =>
        Effect.gen(function* verifyFix() {
          const service = yield* BugWorkflowManagement;
          return yield* service.verifyFix(actorId, value);
        })
    )
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function submitBugApprovalAction(input: unknown) {
  return revalidateBugViews(
    await runBugWorkflowAction(
      input,
      BugSubmitApprovalInputSchema,
      (actorId, value) =>
        Effect.gen(function* submitApproval() {
          const service = yield* BugWorkflowManagement;
          return yield* service.submitApproval(actorId, value);
        })
    )
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function decideBugApprovalAction(input: unknown) {
  return revalidateBugViews(
    await runBugWorkflowAction(
      input,
      BugApprovalDecisionInputSchema,
      (actorId, value) =>
        Effect.gen(function* decideApproval() {
          const service = yield* BugWorkflowManagement;
          return yield* service.decideApproval(actorId, value);
        })
    )
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function recordBugReleaseAction(input: unknown) {
  return revalidateBugViews(
    await runBugWorkflowAction(input, BugReleaseInputSchema, (actorId, value) =>
      Effect.gen(function* recordRelease() {
        const service = yield* BugWorkflowManagement;
        return yield* service.recordRelease(actorId, value);
      })
    )
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function recordBugPostReleaseCheckAction(input: unknown) {
  return revalidateBugViews(
    await runBugWorkflowAction(
      input,
      BugPostReleaseCheckInputSchema,
      (actorId, value) =>
        Effect.gen(function* postReleaseCheck() {
          const service = yield* BugWorkflowManagement;
          return yield* service.postReleaseCheck(actorId, value);
        })
    )
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function archiveBugAction(input: unknown) {
  return revalidateBugViews(
    await runBugWorkflowAction(input, BugVersionInputSchema, (actorId, value) =>
      Effect.gen(function* archiveBug() {
        const service = yield* BugWorkflowManagement;
        return yield* service.archive(actorId, value);
      })
    )
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function restoreBugAction(input: unknown) {
  return revalidateBugViews(
    await runBugWorkflowAction(input, BugVersionInputSchema, (actorId, value) =>
      Effect.gen(function* restoreBug() {
        const service = yield* BugWorkflowManagement;
        return yield* service.restore(actorId, value);
      })
    )
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function reopenBugAction(input: unknown) {
  return revalidateBugViews(
    await runBugWorkflowAction(input, BugVersionInputSchema, (actorId, value) =>
      Effect.gen(function* reopenBug() {
        const service = yield* BugWorkflowManagement;
        return yield* service.reopen(actorId, value);
      })
    )
  );
}
