import { randomUUID } from "node:crypto";

import { Schema } from "effect";

import type {
  BugEvidenceInput,
  BugFixAttemptInput,
  BugVerificationInput,
} from "./bug-contracts";
import {
  BugEvidenceInputSchema,
  BugFixAttemptInputSchema,
  BugVerificationInputSchema,
} from "./bug-contracts";
import { transitionBugStatus } from "./bug-workflow";
import {
  decodeBugWorkflowStatus,
  assertBugEditor,
  assertWritable,
  conflict,
  loadBug,
  required,
  requirePresent,
  updateBugStatus,
  validateExternalUrl,
  workspaceActor,
  writeActivity,
} from "./bug-workflow-internal";
import type { BugWorkflowReceipt } from "./bug-workflow-internal";
import type { Transaction } from "./work-internal";

export const addFixAttempt = async (
  transaction: Transaction,
  actorId: string,
  rawInput: BugFixAttemptInput
): Promise<BugWorkflowReceipt> => {
  const input = Schema.decodeUnknownSync(BugFixAttemptInputSchema)(rawInput);
  const [actor, { bug, project, task }] = await Promise.all([
    workspaceActor(transaction, actorId),
    loadBug(transaction, input.bugId),
  ]);
  await assertBugEditor(transaction, actor, bug);
  assertWritable(bug, task, project);
  if (bug.version !== input.expectedVersion) {
    conflict();
  }
  if (!["triaged", "in_progress", "rejected"].includes(bug.status)) {
    required("This bug is not ready for a fix attempt.");
  }
  const now = new Date();
  await transaction.orm.public.BugFixAttempt.create({
    affectedVersion: input.affectedVersion,
    authorId: actorId,
    bugReportId: bug.id,
    commitUrl: input.commitUrl,
    createdAt: now,
    fixSummary: input.fixSummary.trim(),
    fixedVersion: input.fixedVersion,
    id: randomUUID(),
    pullRequestUrl: input.pullRequestUrl,
    rootCause: input.rootCause.trim(),
    updatedAt: now,
    verificationSteps: input.verificationSteps.map((step) => step.trim()),
    version: 1,
  });
  if (bug.status === "triaged" || bug.status === "rejected") {
    transitionBugStatus({
      actorRole: actor.role,
      currentStatus: bug.status,
      nextStatus: "in_progress",
    });
    return updateBugStatus(transaction, {
      actorId,
      bug,
      details: { fixAttemptCreated: true },
      nextStatus: "in_progress",
      now,
    });
  }
  const nextVersion = bug.version + 1;
  const changed = await transaction.orm.public.BugReport.where({
    id: bug.id,
    version: bug.version,
  }).updateAndCount({ updatedAt: now, version: nextVersion });
  if (!changed) {
    conflict();
  }
  await writeActivity(transaction, {
    action: "bug.fix_attempt_created",
    actorId,
    bugId: bug.id,
    details: {},
    now,
    projectId: project.id,
    taskId: task.id,
  });
  return {
    bugId: bug.id,
    status: decodeBugWorkflowStatus(bug.status),
    version: nextVersion,
  };
};

export const addEvidence = async (
  transaction: Transaction,
  actorId: string,
  rawInput: BugEvidenceInput
): Promise<BugWorkflowReceipt> => {
  const input = Schema.decodeUnknownSync(BugEvidenceInputSchema)(rawInput);
  validateExternalUrl(input.externalUrl);
  if ((input.fileAssetId === null) === (input.externalUrl === null)) {
    required("Choose one uploaded file or HTTPS evidence link.");
  }
  const [actor, { bug, project, task }] = await Promise.all([
    workspaceActor(transaction, actorId),
    loadBug(transaction, input.bugId),
  ]);
  await assertBugEditor(transaction, actor, bug);
  assertWritable(bug, task, project);
  if (bug.version !== input.expectedVersion) {
    conflict();
  }
  if (input.fixAttemptId) {
    const attempt = await transaction.orm.public.BugFixAttempt.where({
      bugReportId: bug.id,
      id: input.fixAttemptId,
    }).first();
    if (!attempt) {
      required("The fix attempt does not belong to this bug.");
    }
  }
  if (input.fileAssetId) {
    const file = await transaction.orm.public.FileAsset.where({
      id: input.fileAssetId,
    }).first();
    if (
      !file ||
      file.taskId !== task.id ||
      file.projectId !== bug.projectId ||
      file.deletedAt ||
      file.copyState !== "ready"
    ) {
      required(
        "Evidence uploads must finish verification before they can be attached."
      );
    }
  }
  const now = new Date();
  await transaction.orm.public.BugEvidence.create({
    bugReportId: bug.id,
    caption: input.caption.trim(),
    createdAt: now,
    externalUrl: input.externalUrl,
    fileAssetId: input.fileAssetId,
    fixAttemptId: input.fixAttemptId,
    id: randomUUID(),
    kind: input.kind,
    uploadedById: actorId,
  });
  const version = bug.version + 1;
  const changed = await transaction.orm.public.BugReport.where({
    id: bug.id,
    version: bug.version,
  }).updateAndCount({ updatedAt: now, version });
  if (!changed) {
    conflict();
  }
  await writeActivity(transaction, {
    action: "bug.evidence_added",
    actorId,
    bugId: bug.id,
    details: { kind: input.kind },
    now,
    projectId: project.id,
    taskId: task.id,
  });
  return {
    bugId: bug.id,
    status: decodeBugWorkflowStatus(bug.status),
    version,
  };
};

export const recordVerification = async (
  transaction: Transaction,
  actorId: string,
  rawInput: BugVerificationInput
): Promise<BugWorkflowReceipt> => {
  const input = Schema.decodeUnknownSync(BugVerificationInputSchema)(rawInput);
  const [actor, { bug, project, task }] = await Promise.all([
    workspaceActor(transaction, actorId),
    loadBug(transaction, input.bugId),
  ]);
  await assertBugEditor(transaction, actor, bug);
  assertWritable(bug, task, project);
  if (bug.version !== input.expectedVersion || bug.status !== "in_progress") {
    conflict();
  }
  const attempt = requirePresent(
    await transaction.orm.public.BugFixAttempt.where({
      bugReportId: bug.id,
      id: input.attemptId,
    }).first(),
    "The fix attempt does not belong to this bug."
  );
  if (attempt.verifiedAt) {
    conflict();
  }
  const now = new Date();
  const changed = await transaction.orm.public.BugFixAttempt.where({
    id: attempt.id,
    version: attempt.version,
  }).updateAndCount({
    testedEnvironment: input.testedEnvironment,
    testedVersion: input.testedVersion.trim(),
    updatedAt: now,
    verificationNotes: input.notes.trim(),
    verificationOutcome: input.outcome,
    verifiedAt: now,
    verifiedById: actorId,
    version: attempt.version + 1,
  });
  if (!changed) {
    conflict();
  }
  const nextStatus =
    input.outcome === "passed" ? "in_verification" : "in_progress";
  const result = await updateBugStatus(transaction, {
    actorId,
    bug,
    details: {
      attemptId: attempt.id,
      outcome: input.outcome,
      testedEnvironment: input.testedEnvironment,
      testedVersion: input.testedVersion,
    },
    nextStatus,
    now,
  });
  await writeActivity(transaction, {
    action: "bug.fix_verified",
    actorId,
    bugId: bug.id,
    details: { attemptId: attempt.id, outcome: input.outcome },
    now,
    projectId: project.id,
    taskId: task.id,
  });
  return result;
};
