import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import { Schema } from "effect";

import {
  clientParticipantIds,
  createCommentInTransaction,
} from "../collaboration/create-comment";
import { AppError } from "../core/action-result";
import { UUIDSchema } from "../core/input-schemas";
import { notifyUsers } from "../notifications/notify-users";
import {
  assertBugEditor,
  conflict,
  forbidden,
  loadBug,
  required,
  updateBugStatus,
  workspaceActor,
  writeActivity,
} from "./bug-workflow-internal";
import type { BugWorkflowReceipt } from "./bug-workflow-internal";
import type { Transaction } from "./work-internal";

const DAY_MS = 24 * 60 * 60 * 1000;
export const CLIENT_REOPEN_LIMIT = 3;
export const NEEDS_INFO_REMINDER_AFTER_MS = 3 * DAY_MS;
export const NEEDS_INFO_AUTOCLOSE_AFTER_MS = 14 * DAY_MS;
export const AWAITING_CLIENT_AUTOCLOSE_AFTER_MS = 7 * DAY_MS;
export const NEEDS_INFO_REMINDER_JOB = "bug.needs_info_reminder";
export const NEEDS_INFO_AUTOCLOSE_JOB = "bug.needs_info_autoclose";
export const AWAITING_CLIENT_AUTOCLOSE_JOB = "bug.awaiting_client_autoclose";

const VersionSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThan(0)
);
const ReasonSchema = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(10_000)
);

export const RequestClientInfoInputSchema = Schema.Struct({
  bugId: UUIDSchema,
  expectedVersion: VersionSchema,
  question: ReasonSchema,
});

export const CloseNotABugInputSchema = Schema.Struct({
  bugId: UUIDSchema,
  expectedVersion: VersionSchema,
  reason: ReasonSchema,
});

export type RequestClientInfoInput = typeof RequestClientInfoInputSchema.Type;
export type CloseNotABugInput = typeof CloseNotABugInputSchema.Type;

type BugRow = Awaited<ReturnType<typeof loadBug>>["bug"];
type ProjectRow = Awaited<ReturnType<typeof loadBug>>["project"];
type TaskRow = Awaited<ReturnType<typeof loadBug>>["task"];

const keyOf = (project: ProjectRow, task: TaskRow): string =>
  `${project.key}-${task.projectTaskNumber}`;

// Automatic changes have no person behind them; the activity names the
// bug's owner and flags the change as automatic.
const systemActorId = (bug: BugRow): string => bug.pickedById ?? bug.reporterId;

const scheduleJob = async (
  transaction: Transaction,
  input: {
    readonly kind: string;
    readonly bugId: string;
    readonly since: Date;
    readonly delayMs: number;
    readonly now: Date;
  }
): Promise<void> => {
  const dedupeKey = `${input.kind}:${input.bugId}:${input.since.getTime()}`;
  await transaction.orm.public.Job.upsert({
    conflictOn: { dedupeKey },
    create: {
      availableAt: new Date(input.now.getTime() + input.delayMs),
      createdAt: input.now,
      dedupeKey,
      id: randomUUID(),
      kind: input.kind,
      payload: { bugId: input.bugId, since: input.since.toISOString() },
      updatedAt: input.now,
    },
    update: { updatedAt: input.now },
  });
};

const notifyClients = async (
  transaction: Transaction,
  bug: BugRow,
  project: ProjectRow,
  task: TaskRow,
  notice: {
    readonly actorId: string | null;
    readonly text: string;
    readonly now: Date;
  }
): Promise<void> => {
  const recipients = await clientParticipantIds(transaction, {
    reporterId: bug.reporterId,
    taskId: task.id,
  });
  await notifyUsers(transaction, {
    actorId: notice.actorId,
    now: notice.now,
    projectId: project.id,
    recipientIds: recipients,
    snippet: task.title,
    taskId: task.id,
    text: notice.text,
    type: "status",
    url: `/portal/bugs/${bug.id}`,
  });
};

const notifyOwner = async (
  transaction: Transaction,
  bug: BugRow,
  project: ProjectRow,
  task: TaskRow,
  notice: {
    readonly actorId: string | null;
    readonly text: string;
    readonly now: Date;
  }
): Promise<void> => {
  const assignees = await transaction.orm.public.TaskAssignee.where({
    taskId: task.id,
  })
    .select("userId")
    .all();
  await notifyUsers(transaction, {
    actorId: notice.actorId,
    now: notice.now,
    projectId: project.id,
    recipientIds: assignees.map(({ userId }) => userId),
    snippet: `${keyOf(project, task)} ${task.title}`,
    taskId: task.id,
    text: notice.text,
    type: "status",
    url: `/bugs/${bug.id}`,
  });
};

// The assignee (or an admin) asks the client a question and waits on them.
export const requestClientInfo = async (
  transaction: Transaction,
  actorId: string,
  rawInput: RequestClientInfoInput
): Promise<BugWorkflowReceipt> => {
  const input = Schema.decodeUnknownSync(RequestClientInfoInputSchema)(
    rawInput
  );
  const [actor, { bug, task }] = await Promise.all([
    workspaceActor(transaction, actorId),
    loadBug(transaction, input.bugId),
  ]);
  if (!bug.clientCompanyId) {
    forbidden("Only client reports can ask the client for information.");
  }
  await assertBugEditor(transaction, actor, bug);
  if (
    bug.version !== input.expectedVersion ||
    !["triaged", "in_progress", "in_verification"].includes(bug.status)
  ) {
    conflict();
  }
  if (!input.question.trim()) {
    required("Write the question for the client.");
  }
  const now = new Date();
  const receipt = await updateBugStatus(transaction, {
    actorId,
    bug,
    details: { question: true },
    fields: {
      needsInfoSince: now,
      statusBeforeNeedsInfo: bug.status,
    },
    nextStatus: "needs_info",
    now,
  });
  await createCommentInTransaction(transaction, {
    actorId,
    body: input.question,
    clientNotice: `${actor.name} needs more information on your bug report`,
    taskId: task.id,
    visibility: "public",
  });
  await Promise.all([
    scheduleJob(transaction, {
      bugId: bug.id,
      delayMs: NEEDS_INFO_REMINDER_AFTER_MS,
      kind: NEEDS_INFO_REMINDER_JOB,
      now,
      since: now,
    }),
    scheduleJob(transaction, {
      bugId: bug.id,
      delayMs: NEEDS_INFO_AUTOCLOSE_AFTER_MS,
      kind: NEEDS_INFO_AUTOCLOSE_JOB,
      now,
      since: now,
    }),
  ]);
  return receipt;
};

// A reply from the client returns the bug to the status it was in.
export const resumeAfterClientReply = async (
  transaction: Transaction,
  actorId: string,
  bugId: string
): Promise<void> => {
  const { bug, project, task } = await loadBug(transaction, bugId);
  if (bug.status !== "needs_info") {
    return;
  }
  const previous =
    bug.statusBeforeNeedsInfo && bug.statusBeforeNeedsInfo !== "needs_info"
      ? bug.statusBeforeNeedsInfo
      : "in_progress";
  const now = new Date();
  await updateBugStatus(transaction, {
    actorId,
    bug,
    details: { clientReplied: true },
    fields: { needsInfoSince: null, statusBeforeNeedsInfo: null },
    nextStatus: previous,
    now,
  });
  await notifyOwner(transaction, bug, project, task, {
    actorId,
    now,
    text: `The client answered ${keyOf(project, task)}`,
  });
};

// Hands a bug to the client to check: after a successful release, or when
// the bug it duplicates has shipped.
export const handOverToClient = async (
  transaction: Transaction,
  input: {
    readonly bugId: string;
    readonly actorId: string;
    readonly now: Date;
  }
): Promise<BugWorkflowReceipt> => {
  const { bug, project, task } = await loadBug(transaction, input.bugId);
  const receipt = await updateBugStatus(transaction, {
    actorId: input.actorId,
    bug,
    details: { handedToClient: true },
    fields: { awaitingClientSince: input.now },
    nextStatus: "awaiting_client",
    now: input.now,
  });
  await notifyClients(transaction, bug, project, task, {
    actorId: input.actorId,
    now: input.now,
    text: "A fix is ready for you to verify",
  });
  await scheduleJob(transaction, {
    bugId: bug.id,
    delayMs: AWAITING_CLIENT_AUTOCLOSE_AFTER_MS,
    kind: AWAITING_CLIENT_AUTOCLOSE_JOB,
    now: input.now,
    since: input.now,
  });
  return receipt;
};

// When the original ships, every client report merged into it is handed to
// its own client to verify.
export const handOverClientDuplicates = async (
  transaction: Transaction,
  originalBugId: string,
  actorId: string,
  now: Date
): Promise<number> => {
  const relations = await transaction.orm.public.BugRelation.where({
    toBugReportId: originalBugId,
    type: "duplicate",
  })
    .select("fromBugReportId")
    .all();
  if (relations.length === 0) {
    return 0;
  }
  const duplicates = await transaction.orm.public.BugReport.where((bug) =>
    and(
      bug.id.in(relations.map(({ fromBugReportId }) => fromBugReportId)),
      bug.clientCompanyId.isNotNull(),
      bug.status.eq("duplicate")
    )
  )
    .select("id")
    .all();
  for (const duplicate of duplicates) {
    // Each hand-over reads and updates its own bug row.
    // eslint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop
    await handOverToClient(transaction, { actorId, bugId: duplicate.id, now });
  }
  return duplicates.length;
};

// An assignee or admin closes a client report that is not a bug, with the
// reason shown to the client as a public reply.
export const closeClientBugAsNotABug = async (
  transaction: Transaction,
  actorId: string,
  rawInput: CloseNotABugInput
): Promise<BugWorkflowReceipt> => {
  const input = Schema.decodeUnknownSync(CloseNotABugInputSchema)(rawInput);
  const [actor, { bug, project, task }] = await Promise.all([
    workspaceActor(transaction, actorId),
    loadBug(transaction, input.bugId),
  ]);
  if (!bug.clientCompanyId) {
    forbidden("Only client reports can be closed as not a bug.");
  }
  await assertBugEditor(transaction, actor, bug);
  if (
    bug.version !== input.expectedVersion ||
    !["reported", "triaged", "in_progress", "needs_info"].includes(
      bug.status
    ) ||
    task.archivedAt ||
    project.archivedAt
  ) {
    conflict();
  }
  if (!input.reason.trim()) {
    required("Tell the client why this is not a bug.");
  }
  const now = new Date();
  const receipt = await updateBugStatus(transaction, {
    actorId,
    bug,
    details: { reason: "not_a_bug" },
    fields: {
      needsInfoSince: null,
      resolution: "not_a_bug",
      statusBeforeNeedsInfo: null,
    },
    nextStatus: "closed",
    now,
  });
  await createCommentInTransaction(transaction, {
    actorId,
    body: input.reason,
    clientNotice: `${actor.name} closed your bug report as not a bug`,
    taskId: task.id,
    visibility: "public",
  });
  return receipt;
};

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
