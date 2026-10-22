import type { Effect } from "effect";

import { AppError } from "../core/action-result";
import { run } from "../portal/portal-bug-access";
import type { PortalActor } from "../portal/portal-contracts";
import {
  approvalNotFound,
  loadVisibleRequest,
  toApprovalStatus,
} from "./approval-access";
import type {
  ApprovalDecisionReceipt,
  DecideApprovalInput,
} from "./approval-contracts";
import { notifyStaffOfDecision } from "./approval-notify";

const conflict = (message: string) =>
  new AppError({ code: "CONFLICT", message });

// Records the client's decision. It is written once: the update only matches
// a request that is still pending, so of two racing decisions exactly one
// lands, and the loser learns it was too late. The same person repeating the
// same decision (a retry) gets the recorded outcome back unchanged.
export const decideApproval = (
  actor: PortalActor,
  input: DecideApprovalInput
): Effect.Effect<ApprovalDecisionReceipt, AppError> =>
  run(async (transaction) => {
    const approving = input.decision === "approve";
    const comment = input.comment.trim();
    const request = await loadVisibleRequest(
      transaction,
      actor.clientCompanyId,
      input.requestId
    );
    if (!request) {
      throw approvalNotFound();
    }
    if (!approving && !comment) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        fieldErrors: { comment: "Tell the team what needs to change." },
        message: "Tell the team what needs to change.",
      });
    }
    const status = approving ? "approved" : "changes_requested";
    const now = new Date();
    const changed = await transaction.orm.public.ApprovalRequest.where({
      id: request.id,
      status: "pending",
    }).updateAndCount({
      decidedAt: now,
      decidedById: actor.id,
      decisionComment: comment || null,
      status,
    });
    if (!changed) {
      const current = await transaction.orm.public.ApprovalRequest.where({
        id: request.id,
      })
        .select("decidedById", "status")
        .first();
      if (current?.decidedById === actor.id && current.status === status) {
        return { requestId: request.id, status };
      }
      throw conflict(
        current?.status === "cancelled"
          ? "The team withdrew this request."
          : "This request was already answered."
      );
    }
    await notifyStaffOfDecision(transaction, {
      actorId: actor.id,
      actorName: actor.name,
      approved: approving,
      comment: comment || null,
      now,
      projectId: request.projectId,
      requestedById: request.requestedById,
      subjectTitle: request.subjectTitle,
      taskId: request.taskId,
    });
    return { requestId: request.id, status: toApprovalStatus(status) };
  });
