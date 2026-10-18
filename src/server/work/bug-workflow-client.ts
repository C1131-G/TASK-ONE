import { and } from "@prisma/orm-postgres/orm-client";
import { Schema } from "effect";

import { createCommentInTransaction } from "../collaboration/create-comment";
import {
  NEEDS_INFO_REMINDER_AFTER_MS,
  NEEDS_INFO_AUTOCLOSE_AFTER_MS,
  AWAITING_CLIENT_AUTOCLOSE_AFTER_MS,
  NEEDS_INFO_REMINDER_JOB,
  NEEDS_INFO_AUTOCLOSE_JOB,
  AWAITING_CLIENT_AUTOCLOSE_JOB,
  RequestClientInfoInputSchema,
  CloseNotABugInputSchema,
  keyOf,
  scheduleJob,
  notifyClients,
  notifyOwner,
} from "./bug-workflow-client-support";
import type {
  CloseNotABugInput,
  RequestClientInfoInput,
} from "./bug-workflow-client-support";
import {
  assertBugEditor,
  conflict,
  forbidden,
  loadBug,
  required,
  updateBugStatus,
  workspaceActor,
} from "./bug-workflow-internal";
import type { BugWorkflowReceipt } from "./bug-workflow-internal";
import type { Transaction } from "./work-internal";

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
