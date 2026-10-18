import { createCommentInTransaction } from "../collaboration/create-comment";
import { AppError } from "../core/action-result";
import {
  CLIENT_REOPEN_LIMIT,
  keyOf,
  notifyOwner,
} from "./bug-workflow-client-support";
import {
  conflict,
  forbidden,
  loadBug,
  required,
  updateBugStatus,
  writeActivity,
} from "./bug-workflow-internal";
import type { BugWorkflowReceipt } from "./bug-workflow-internal";
import type { Transaction } from "./work-internal";

export interface ClientActor {
  readonly id: string;
  readonly name: string;
  readonly clientCompanyId: string;
}

// Another company's bug reads as missing so its existence is never confirmed.
const loadClientBug = async (
  transaction: Transaction,
  actor: ClientActor,
  bugId: string
) => {
  const bug = await transaction.orm.public.BugReport.where({
    clientCompanyId: actor.clientCompanyId,
    id: bugId,
  }).first();
  if (!bug) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The bug report was not found.",
    });
  }
  return loadBug(transaction, bug.id);
};

// Any user of the company can confirm that a fix works; the bug closes and
// the client may leave a rating with it.
export const confirmClientFix = async (
  transaction: Transaction,
  actor: ClientActor,
  input: {
    readonly bugId: string;
    readonly expectedVersion: number;
    readonly satisfaction?: "up" | "down" | undefined;
    readonly comment?: string | undefined;
  }
): Promise<BugWorkflowReceipt> => {
  const { bug, project, task } = await loadClientBug(
    transaction,
    actor,
    input.bugId
  );
  if (
    bug.status !== "awaiting_client" ||
    bug.version !== input.expectedVersion
  ) {
    conflict();
  }
  const now = new Date();
  const comment = input.comment?.trim() || null;
  const receipt = await updateBugStatus(transaction, {
    actorId: actor.id,
    bug,
    details: { confirmedBy: actor.id },
    fields: {
      awaitingClientSince: null,
      resolution: "confirmed",
      ...(input.satisfaction
        ? { satisfaction: input.satisfaction, satisfactionComment: comment }
        : {}),
    },
    nextStatus: "closed",
    now,
  });
  await notifyOwner(transaction, bug, project, task, {
    actorId: actor.id,
    now,
    text: `${actor.name} confirmed the fix for ${keyOf(project, task)}`,
  });
  return receipt;
};

// A rating can follow the confirmation, once, from anyone in the company.
export const rateClientBug = async (
  transaction: Transaction,
  actor: ClientActor,
  input: {
    readonly bugId: string;
    readonly satisfaction: "up" | "down";
    readonly comment?: string | undefined;
  }
): Promise<void> => {
  const { bug, project, task } = await loadClientBug(
    transaction,
    actor,
    input.bugId
  );
  if (
    bug.status !== "closed" ||
    bug.resolution !== "confirmed" ||
    bug.satisfaction !== null
  ) {
    forbidden("This bug can no longer be rated.");
  }
  const now = new Date();
  const rated = await transaction.orm.public.BugReport.where({
    id: bug.id,
    version: bug.version,
  }).updateAndCount({
    satisfaction: input.satisfaction,
    satisfactionComment: input.comment?.trim() || null,
    updatedAt: now,
    version: bug.version + 1,
  });
  if (!rated) {
    conflict();
  }
  await writeActivity(transaction, {
    action: "bug.client_rated",
    actorId: actor.id,
    bugId: bug.id,
    details: { satisfaction: input.satisfaction },
    now,
    projectId: project.id,
    taskId: task.id,
  });
  await notifyOwner(transaction, bug, project, task, {
    actorId: actor.id,
    now,
    text: `${actor.name} rated ${keyOf(project, task)} ${input.satisfaction === "up" ? "👍" : "👎"}`,
  });
};

// "Still broken": back to the team with the reason, until the client has
// used up its reopens and has to talk to its account manager.
export const reopenClientFix = async (
  transaction: Transaction,
  actor: ClientActor,
  input: {
    readonly bugId: string;
    readonly expectedVersion: number;
    readonly reason: string;
  }
): Promise<BugWorkflowReceipt> => {
  const { bug, project, task } = await loadClientBug(
    transaction,
    actor,
    input.bugId
  );
  if (
    bug.status !== "awaiting_client" ||
    bug.version !== input.expectedVersion
  ) {
    conflict();
  }
  if (bug.clientReopenCount >= CLIENT_REOPEN_LIMIT) {
    forbidden(
      "This bug has been reopened too many times. Contact your account manager."
    );
  }
  if (!input.reason.trim()) {
    required("Tell us what is still broken.");
  }
  const now = new Date();
  // A merged report nobody had picked goes back to the queue.
  const nextStatus = bug.pickedById ? "triaged" : "reported";
  const receipt = await updateBugStatus(transaction, {
    actorId: actor.id,
    bug,
    details: { reopenedByClient: true },
    fields: {
      awaitingClientSince: null,
      clientReopenCount: bug.clientReopenCount + 1,
    },
    nextStatus,
    now,
  });
  await createCommentInTransaction(transaction, {
    actorId: actor.id,
    body: input.reason,
    taskId: task.id,
    visibility: "public",
  });
  await notifyOwner(transaction, bug, project, task, {
    actorId: actor.id,
    now,
    text: `${actor.name} says ${keyOf(project, task)} is still broken`,
  });
  return receipt;
};
