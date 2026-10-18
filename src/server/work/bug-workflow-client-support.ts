import { randomUUID } from "node:crypto";

import { Schema } from "effect";

import { clientParticipantIds } from "../collaboration/create-comment";
import { UUIDSchema } from "../core/input-schemas";
import { notifyUsers } from "../notifications/notify-users";
import type { loadBug } from "./bug-workflow-internal";
import type { Transaction } from "./work-internal";

export const DAY_MS = 24 * 60 * 60 * 1000;
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

export type BugRow = Awaited<ReturnType<typeof loadBug>>["bug"];
export type ProjectRow = Awaited<ReturnType<typeof loadBug>>["project"];
export type TaskRow = Awaited<ReturnType<typeof loadBug>>["task"];

export const keyOf = (project: ProjectRow, task: TaskRow): string =>
  `${project.key}-${task.projectTaskNumber}`;

// Automatic changes have no person behind them; the activity names the
// bug's owner and flags the change as automatic.
export const systemActorId = (bug: BugRow): string =>
  bug.pickedById ?? bug.reporterId;

export const scheduleJob = async (
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

export const notifyClients = async (
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

export const notifyOwner = async (
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
