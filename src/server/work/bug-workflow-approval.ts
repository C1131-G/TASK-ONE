import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import { Schema } from "effect";

import type {
  BugApprovalDecisionInput,
  BugSubmitApprovalInput,
} from "./bug-contracts";
import {
  BugApprovalDecisionInputSchema,
  BugSubmitApprovalInputSchema,
} from "./bug-contracts";
import { hasRequiredBugEvidence } from "./bug-workflow";
import {
  assertBugEditor,
  assertWritable,
  conflict,
  forbidden,
  loadBug,
  required,
  requirePresent,
  updateBugStatus,
  workspaceActor,
  writeActivity,
} from "./bug-workflow-internal";
import type { BugWorkflowReceipt } from "./bug-workflow-internal";
import type { Transaction } from "./work-internal";
import { notifyTaskAssignees } from "./work-notifications";

export const submitApproval = async (
  transaction: Transaction,
  actorId: string,
  rawInput: BugSubmitApprovalInput
): Promise<BugWorkflowReceipt> => {
  const input = Schema.decodeUnknownSync(BugSubmitApprovalInputSchema)(
    rawInput
  );
  const [actor, { bug, project, task }] = await Promise.all([
    workspaceActor(transaction, actorId),
    loadBug(transaction, input.bugId),
  ]);
  await assertBugEditor(transaction, actor, bug);
  assertWritable(bug, task, project);
  if (
    bug.version !== input.expectedVersion ||
    bug.status !== "in_verification"
  ) {
    conflict();
  }
  const attempt = requirePresent(
    await transaction.orm.public.BugFixAttempt.where({
      bugReportId: bug.id,
      id: input.fixAttemptId,
    }).first(),
    "A successful verification is required before approval submission."
  );
  if (attempt.verificationOutcome !== "passed" || !attempt.verifiedAt) {
    required(
      "A successful verification is required before approval submission."
    );
  }
  const verifiedAt = requirePresent(
    attempt.verifiedAt,
    "A successful verification is required before approval submission."
  );
  const bugEvidence = await transaction.orm.public.BugEvidence.where({
    bugReportId: bug.id,
  }).all();
  const evidence = bugEvidence.filter(
    (item) => item.fixAttemptId === null || item.fixAttemptId === attempt.id
  );
  const fileIds = evidence.flatMap((item) =>
    item.fileAssetId ? [item.fileAssetId] : []
  );
  const files =
    fileIds.length > 0
      ? await transaction.orm.public.FileAsset.where((file) =>
          file.id.in(fileIds)
        ).all()
      : [];
  const fileById = new Map(files.map((file) => [file.id, file]));
  const usableEvidence = [];
  for (const item of evidence) {
    if (item.fileAssetId) {
      const asset = fileById.get(item.fileAssetId);
      if (asset && !asset.deletedAt && asset.copyState === "ready") {
        usableEvidence.push(item);
      }
    } else if (item.externalUrl?.startsWith("https://")) {
      usableEvidence.push(item);
    }
  }
  if (!hasRequiredBugEvidence(usableEvidence, attempt.id)) {
    required(
      "Verified before and after evidence is required before approval submission."
    );
  }
  const now = new Date();
  const beforeEvidenceIds: string[] = [];
  const afterEvidenceIds: string[] = [];
  for (const item of usableEvidence) {
    if (item.kind === "before") {
      beforeEvidenceIds.push(item.id);
    }
    if (item.kind === "after") {
      afterEvidenceIds.push(item.id);
    }
  }
  await transaction.orm.public.BugApproval.create({
    bugReportId: bug.id,
    comment: null,
    decidedAt: null,
    decidedById: null,
    fixAttemptId: attempt.id,
    id: randomUUID(),
    rejectionReason: null,
    snapshot: {
      affectedVersion: attempt.affectedVersion,
      afterEvidenceIds,
      beforeEvidenceIds,
      commitUrl: attempt.commitUrl,
      fixSummary: attempt.fixSummary,
      fixedVersion: attempt.fixedVersion,
      pullRequestUrl: attempt.pullRequestUrl,
      rootCause: attempt.rootCause,
      verificationNotes: attempt.verificationNotes,
      verificationSteps: attempt.verificationSteps,
      verifiedAt: verifiedAt.toISOString(),
      verifiedById: attempt.verifiedById,
    },
    status: "pending",
    submittedAt: now,
    submittedById: actorId,
  });
  const result = await updateBugStatus(transaction, {
    actorId,
    bug,
    details: { fixAttemptId: attempt.id },
    nextStatus: "awaiting_admin_approval",
    now,
  });
  await writeActivity(transaction, {
    action: "bug.approval_submitted",
    actorId,
    bugId: bug.id,
    details: { fixAttemptId: attempt.id },
    now,
    projectId: project.id,
    taskId: task.id,
  });
  const admins = await transaction.orm.public.User.where((user) =>
    and(user.role.eq("admin"), user.deactivatedAt.isNull())
  )
    .select("id")
    .all();
  await notifyTaskAssignees(
    transaction,
    { id: actorId, name: actor.name },
    { id: task.id, projectId: project.id, title: task.title },
    admins.map(({ id }) => id),
    now,
    "update",
    `/bugs/${bug.id}`
  );
  return result;
};

export const decideApproval = async (
  transaction: Transaction,
  actorId: string,
  rawInput: BugApprovalDecisionInput
): Promise<BugWorkflowReceipt> => {
  const input = Schema.decodeUnknownSync(BugApprovalDecisionInputSchema)(
    rawInput
  );
  const actor = await workspaceActor(transaction, actorId);
  if (actor.role !== "admin") {
    forbidden("Only admins can decide bug approvals.");
  }
  const approval = requirePresent(
    await transaction.orm.public.BugApproval.where({
      id: input.approvalId,
    }).first(),
    "The approval request was not found."
  );
  if (approval.status !== "pending") {
    conflict();
  }
  const { bug, project, task } = await loadBug(
    transaction,
    approval.bugReportId
  );
  if (
    bug.version !== input.expectedVersion ||
    bug.status !== "awaiting_admin_approval"
  ) {
    conflict();
  }
  if (input.decision === "rejected" && !input.rejectionReason?.trim()) {
    required("Add a reason when rejecting a fix.");
  }
  const now = new Date();
  const changed = await transaction.orm.public.BugApproval.where({
    id: approval.id,
    status: "pending",
  }).updateAndCount({
    comment: input.comment?.trim() || null,
    decidedAt: now,
    decidedById: actorId,
    rejectionReason:
      input.decision === "rejected"
        ? (input.rejectionReason?.trim() ?? null)
        : null,
    status: input.decision,
  });
  if (!changed) {
    conflict();
  }
  const nextStatus =
    input.decision === "approved" ? "approved_for_release" : "rejected";
  const result = await updateBugStatus(transaction, {
    actorId,
    bug,
    details: { approvalId: approval.id, decision: input.decision },
    nextStatus,
    now,
  });
  await writeActivity(transaction, {
    action: `bug.approval_${input.decision}`,
    actorId,
    bugId: bug.id,
    details: {
      approvalId: approval.id,
      comment: input.comment,
      rejectionReason: input.rejectionReason,
    },
    now,
    projectId: project.id,
    taskId: task.id,
  });
  await notifyTaskAssignees(
    transaction,
    { id: actorId, name: actor.name },
    { id: task.id, projectId: project.id, title: task.title },
    [bug.reporterId],
    now,
    "update",
    `/bugs/${bug.id}`
  );
  return result;
};
