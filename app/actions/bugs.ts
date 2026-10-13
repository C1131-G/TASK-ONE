"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import {
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import { runServerAction } from "@/src/server/core/server-action";
import {
  BugApprovalDecisionInputSchema,
  BugEvidenceInputSchema,
  BugFixAttemptInputSchema,
  BugListInputSchema,
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
  BugHistory,
  BugHistoryLive,
  BugHistorySchema,
} from "@/src/server/work/bug-history";
import {
  BugManagement,
  BugManagementLive,
  BugListSchema,
  BugReportItemSchema,
} from "@/src/server/work/bug-management";
import { BugWorkflowManagement } from "@/src/server/work/bug-workflow-management";

import {
  revalidateBugViews,
  runBugWorkflowAction,
} from "./bug-workflow-action-shared";
import { requestHeadersOrFail } from "./tasks-shared";

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
export async function getBugAction(input: unknown) {
  return await runServerAction(
    input,
    Schema.Struct({ bugId: UUIDSchema }),
    (validated) =>
      Effect.gen(function* getBug() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const bugs = yield* BugManagement;
        return yield* bugs.getBug(actor.id, validated.bugId);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(BugManagementLive)
      ),
    undefined,
    BugReportItemSchema
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listBugsAction(input: unknown) {
  return await runServerAction(
    input,
    BugListInputSchema,
    (validated) =>
      Effect.gen(function* listBugs() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const bugs = yield* BugManagement;
        return yield* bugs.listBugs(actor.id, validated);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(BugManagementLive)
      ),
    undefined,
    BugListSchema
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function getBugHistoryAction(input: unknown) {
  return await runServerAction(
    input,
    Schema.Struct({ bugId: UUIDSchema }),
    (validated) =>
      Effect.gen(function* getBugHistory() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const history = yield* BugHistory;
        return yield* history.get(actor.id, validated.bugId);
      }).pipe(Effect.provide(AuthSessionLive), Effect.provide(BugHistoryLive)),
    undefined,
    BugHistorySchema
  );
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
