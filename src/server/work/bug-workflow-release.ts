import { randomUUID } from "node:crypto";

import { Schema } from "effect";

import type {
  BugPostReleaseCheckInput,
  BugReleaseInput,
} from "./bug-contracts";
import {
  BugPostReleaseCheckInputSchema,
  BugReleaseInputSchema,
} from "./bug-contracts";
import {
  handOverClientDuplicates,
  handOverToClient,
} from "./bug-workflow-client";
import {
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

export const recordRelease = async (
  transaction: Transaction,
  actorId: string,
  rawInput: BugReleaseInput
): Promise<BugWorkflowReceipt> => {
  const input = Schema.decodeUnknownSync(BugReleaseInputSchema)(rawInput);
  const actor = await workspaceActor(transaction, actorId);
  if (actor.role !== "admin") {
    forbidden("Only admins can record bug releases.");
  }
  const { bug, project, task } = await loadBug(transaction, input.bugId);
  if (
    bug.version !== input.expectedVersion ||
    bug.status !== "approved_for_release"
  ) {
    conflict();
  }
  const approval = requirePresent(
    await transaction.orm.public.BugApproval.where({
      bugReportId: bug.id,
      id: input.approvalId,
    }).first(),
    "An approved submission is required before release."
  );
  if (approval.status !== "approved") {
    required("An approved submission is required before release.");
  }
  const now = new Date();
  await transaction.orm.public.BugRelease.create({
    approvalId: approval.id,
    bugReportId: bug.id,
    checkedAt: null,
    createdAt: now,
    environment: input.environment,
    id: randomUUID(),
    postReleaseCheckNotes: input.notes,
    postReleaseCheckPassed: false,
    releasedAt: now,
    releasedById: actorId,
    version: input.version.trim(),
  });
  const result = await updateBugStatus(transaction, {
    actorId,
    bug,
    details: {
      approvalId: approval.id,
      environment: input.environment,
      version: input.version,
    },
    nextStatus: "released",
    now,
  });
  await writeActivity(transaction, {
    action: "bug.released",
    actorId,
    bugId: bug.id,
    details: { environment: input.environment, version: input.version },
    now,
    projectId: project.id,
    taskId: task.id,
  });
  return result;
};

export const postReleaseCheck = async (
  transaction: Transaction,
  actorId: string,
  rawInput: BugPostReleaseCheckInput
): Promise<BugWorkflowReceipt> => {
  const input = Schema.decodeUnknownSync(BugPostReleaseCheckInputSchema)(
    rawInput
  );
  const actor = await workspaceActor(transaction, actorId);
  if (actor.role !== "admin") {
    forbidden("Only admins can record post-release checks.");
  }
  const { bug, project, task } = await loadBug(transaction, input.bugId);
  if (bug.version !== input.expectedVersion || bug.status !== "released") {
    conflict();
  }
  const release = requirePresent(
    await transaction.orm.public.BugRelease.where({
      bugReportId: bug.id,
      id: input.releaseId,
    }).first(),
    "The release record was not found."
  );
  const now = new Date();
  const changed = await transaction.orm.public.BugRelease.where({
    id: release.id,
    postReleaseCheckPassed: false,
  }).updateAndCount({
    checkedAt: input.passed ? now : null,
    postReleaseCheckNotes: input.notes.trim(),
    postReleaseCheckPassed: input.passed,
  });
  if (!changed) {
    conflict();
  }
  if (!input.passed) {
    const nextVersion = bug.version + 1;
    const updated = await transaction.orm.public.BugReport.where({
      id: bug.id,
      version: bug.version,
    }).updateAndCount({ updatedAt: now, version: nextVersion });
    if (!updated) {
      conflict();
    }
    await writeActivity(transaction, {
      action: "bug.post_release_check_failed",
      actorId,
      bugId: bug.id,
      details: { notes: input.notes, releaseId: release.id },
      now,
      projectId: project.id,
      taskId: task.id,
    });
    return { bugId: bug.id, status: "released", version: nextVersion };
  }
  // Reports from clients end with the client verifying the fix, not with an
  // internal close; so do client reports merged into this bug.
  if (bug.clientCompanyId) {
    const handedOver = await handOverToClient(transaction, {
      actorId,
      bugId: bug.id,
      now,
    });
    await handOverClientDuplicates(transaction, bug.id, actorId, now);
    return handedOver;
  }
  const result = await updateBugStatus(transaction, {
    actorId,
    bug,
    details: { postReleaseCheck: "passed", releaseId: release.id },
    nextStatus: "closed",
    now,
  });
  await handOverClientDuplicates(transaction, bug.id, actorId, now);
  await writeActivity(transaction, {
    action: "bug.closed",
    actorId,
    bugId: bug.id,
    details: { releaseId: release.id },
    now,
    projectId: project.id,
    taskId: task.id,
  });
  return result;
};
