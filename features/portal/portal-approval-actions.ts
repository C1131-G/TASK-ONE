"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import { Effect } from "effect";
import { refresh, revalidatePath } from "next/cache";

import { withKey } from "@/features/portal/portal-action-helpers";
import {
  runPortalAction,
  toPortalActor,
} from "@/features/portal/portal-action-runner";
import {
  ApprovalDecisionReceiptSchema,
  DecideApprovalInputSchema,
} from "@/src/server/approvals/approval-contracts";
import { PortalApprovals } from "@/src/server/approvals/portal-approvals-service";
import { Idempotency } from "@/src/server/core/idempotency";

// Approve a deliverable, or ask for changes with a comment. The decision is
// written once on the server; a retry with the same key replays the result.
export async function decideApprovalAction(input: unknown) {
  const result = await runPortalAction(
    input,
    withKey(DecideApprovalInputSchema),
    (user, validated) =>
      Effect.gen(function* decideApproval() {
        const approvals = yield* PortalApprovals;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...decision } = validated;
        return yield* idempotency.run({
          actorId: user.id,
          execute: () => approvals.decide(toPortalActor(user), decision),
          input: decision,
          key: idempotencyKey,
          operation: "portal.approval.decide",
          resultSchema: ApprovalDecisionReceiptSchema,
        });
      }),
    ApprovalDecisionReceiptSchema
  );
  if (result.ok) {
    revalidatePath("/portal/approvals");
    refresh();
  }
  return result;
}
