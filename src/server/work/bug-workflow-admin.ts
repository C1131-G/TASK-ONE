import { Schema } from "effect";

import type { BugVersionInput } from "./bug-contracts";
import { BugVersionInputSchema } from "./bug-contracts";
import { transitionBugStatus } from "./bug-workflow";
import {
  decodeBugWorkflowStatus,
  assertWritable,
  conflict,
  forbidden,
  loadBug,
  updateBugStatus,
  workspaceActor,
  writeActivity,
} from "./bug-workflow-internal";
import type { BugWorkflowReceipt } from "./bug-workflow-internal";
import type { Transaction } from "./work-internal";

export const archiveBug = async (
  transaction: Transaction,
  actorId: string,
  rawInput: BugVersionInput
): Promise<BugWorkflowReceipt> => {
  const input = Schema.decodeUnknownSync(BugVersionInputSchema)(rawInput);
  const actor = await workspaceActor(transaction, actorId);
  if (actor.role !== "admin") {
    forbidden("Only admins can archive bugs.");
  }
  const { bug, project, task } = await loadBug(transaction, input.bugId);
  if (
    bug.version !== input.expectedVersion ||
    task.archivedAt ||
    project.archivedAt
  ) {
    conflict();
  }
  const now = new Date();
  const taskUpdated = await transaction.orm.public.Task.where({
    archivedAt: null,
    id: task.id,
    version: task.version,
  }).updateAndCount({
    archivedAt: now,
    archivedById: actorId,
    updatedAt: now,
    version: task.version + 1,
  });
  if (!taskUpdated) {
    conflict();
  }
  const version = bug.version + 1;
  const bugUpdated = await transaction.orm.public.BugReport.where({
    id: bug.id,
    version: bug.version,
  }).updateAndCount({ updatedAt: now, version });
  if (!bugUpdated) {
    conflict();
  }
  await writeActivity(transaction, {
    action: "bug.archived",
    actorId,
    bugId: bug.id,
    details: { version },
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

export const restoreBug = async (
  transaction: Transaction,
  actorId: string,
  rawInput: BugVersionInput
): Promise<BugWorkflowReceipt> => {
  const input = Schema.decodeUnknownSync(BugVersionInputSchema)(rawInput);
  const actor = await workspaceActor(transaction, actorId);
  if (actor.role !== "admin") {
    forbidden("Only admins can restore bugs.");
  }
  const { bug, project, task } = await loadBug(transaction, input.bugId);
  if (
    bug.version !== input.expectedVersion ||
    !task.archivedAt ||
    project.archivedAt
  ) {
    conflict();
  }
  const now = new Date();
  const taskUpdated = await transaction.orm.public.Task.where({
    archivedAt: task.archivedAt,
    id: task.id,
    version: task.version,
  }).updateAndCount({
    archivedAt: null,
    archivedById: null,
    updatedAt: now,
    version: task.version + 1,
  });
  if (!taskUpdated) {
    conflict();
  }
  const version = bug.version + 1;
  const bugUpdated = await transaction.orm.public.BugReport.where({
    id: bug.id,
    version: bug.version,
  }).updateAndCount({ updatedAt: now, version });
  if (!bugUpdated) {
    conflict();
  }
  await writeActivity(transaction, {
    action: "bug.restored",
    actorId,
    bugId: bug.id,
    details: { version },
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

export const reopenBug = async (
  transaction: Transaction,
  actorId: string,
  rawInput: BugVersionInput
): Promise<BugWorkflowReceipt> => {
  const input = Schema.decodeUnknownSync(BugVersionInputSchema)(rawInput);
  const actor = await workspaceActor(transaction, actorId);
  if (actor.role !== "admin") {
    forbidden("Only admins can reopen closed bugs.");
  }
  const { bug, project, task } = await loadBug(transaction, input.bugId);
  if (
    bug.version !== input.expectedVersion ||
    !["closed", "awaiting_client", "needs_info"].includes(bug.status)
  ) {
    conflict();
  }
  assertWritable({ status: "in_progress" }, task, project);
  // Only a closed bug follows the ordinary reopen rule; waiting-on-client
  // states are an admin's to override.
  const nextStatus =
    bug.status === "closed"
      ? transitionBugStatus({
          actorRole: "admin",
          currentStatus: "closed",
          nextStatus: "in_progress",
        })
      : "in_progress";
  const now = new Date();
  const result = await updateBugStatus(transaction, {
    actorId,
    bug,
    details: { reopened: true },
    fields: {
      awaitingClientSince: null,
      needsInfoSince: null,
      resolution: null,
      statusBeforeNeedsInfo: null,
    },
    nextStatus,
    now,
  });
  await writeActivity(transaction, {
    action: "bug.reopened",
    actorId,
    bugId: bug.id,
    details: {},
    now,
    projectId: project.id,
    taskId: task.id,
  });
  return result;
};
