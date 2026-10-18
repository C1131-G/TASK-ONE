import {
  keyOf,
  systemActorId,
  notifyClients,
  notifyOwner,
} from "./bug-workflow-client-support";
import type { BugRow } from "./bug-workflow-client-support";
import { loadBug, updateBugStatus } from "./bug-workflow-internal";
import type { Transaction } from "./work-internal";

// The jobs below only act while the bug is still waiting in the state they
// were scheduled for, so an answered or reopened bug is left alone.
const stillWaiting = (
  bug: BugRow,
  status: string,
  since: Date,
  sinceField: "needsInfoSince" | "awaitingClientSince"
): boolean =>
  bug[sinceField]?.getTime() === since.getTime() && bug.status === status;

export const remindNeedsInfo = async (
  transaction: Transaction,
  bugId: string,
  since: Date
): Promise<boolean> => {
  const found = await transaction.orm.public.BugReport.where({
    id: bugId,
  }).first();
  if (!found || !stillWaiting(found, "needs_info", since, "needsInfoSince")) {
    return false;
  }
  const { bug, project, task } = await loadBug(transaction, bugId);
  await notifyClients(transaction, bug, project, task, {
    actorId: null,
    now: new Date(),
    text: "We are still waiting for your reply on your bug report",
  });
  return true;
};

export const autoCloseNeedsInfo = async (
  transaction: Transaction,
  bugId: string,
  since: Date
): Promise<boolean> => {
  const found = await transaction.orm.public.BugReport.where({
    id: bugId,
  }).first();
  if (!found || !stillWaiting(found, "needs_info", since, "needsInfoSince")) {
    return false;
  }
  const { bug, project, task } = await loadBug(transaction, bugId);
  const now = new Date();
  await updateBugStatus(transaction, {
    actorId: systemActorId(bug),
    bug,
    details: { automatic: true, reason: "no_response" },
    fields: {
      needsInfoSince: null,
      resolution: "no_response",
      statusBeforeNeedsInfo: null,
    },
    nextStatus: "closed",
    now,
  });
  await Promise.all([
    notifyClients(transaction, bug, project, task, {
      actorId: null,
      now,
      text: "Your bug report was closed because we did not hear back",
    }),
    notifyOwner(transaction, bug, project, task, {
      actorId: null,
      now,
      text: `${keyOf(project, task)} was closed: no response from the client`,
    }),
  ]);
  return true;
};

export const autoCloseAwaitingClient = async (
  transaction: Transaction,
  bugId: string,
  since: Date
): Promise<boolean> => {
  const found = await transaction.orm.public.BugReport.where({
    id: bugId,
  }).first();
  if (
    !found ||
    !stillWaiting(found, "awaiting_client", since, "awaitingClientSince")
  ) {
    return false;
  }
  const { bug, project, task } = await loadBug(transaction, bugId);
  const now = new Date();
  await updateBugStatus(transaction, {
    actorId: systemActorId(bug),
    bug,
    details: { automatic: true, reason: "unconfirmed" },
    fields: { awaitingClientSince: null, resolution: "unconfirmed" },
    nextStatus: "closed",
    now,
  });
  await Promise.all([
    notifyClients(transaction, bug, project, task, {
      actorId: null,
      now,
      text: "Your bug report was closed after a week without a reply",
    }),
    notifyOwner(transaction, bug, project, task, {
      actorId: null,
      now,
      text: `${keyOf(project, task)} was closed: the client did not verify the fix`,
    }),
  ]);
  return true;
};
