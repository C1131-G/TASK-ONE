import { randomUUID } from "node:crypto";

import { and, or } from "@prisma/orm-postgres/orm-client";

import type { SlaSettings } from "../company/sla-settings";
import { loadSlaSettings } from "../company/sla-settings";
import { activeAdminIds, notifyUsers } from "../notifications/notify-users";
import { SLA_SWEEP_INTERVAL_MS, SLA_SWEEP_JOB, WARNING_RATIO } from "./bug-sla";
import type { SlaRow } from "./bug-sla";
import { businessElapsedMs } from "./business-time";
import type { Transaction } from "./work-internal";

const keyOf = (
  project: { readonly key: string },
  task: { readonly projectTaskNumber: number }
): string => `${project.key}-${task.projectTaskNumber}`;

interface SweepContext {
  readonly sla: SlaRow;
  readonly settings: SlaSettings;
  readonly now: Date;
  readonly bug: {
    readonly id: string;
    readonly clientCompanyId: string | null;
    readonly taskId: string;
    readonly projectId: string;
  };
  readonly key: string;
  readonly title: string;
  // Loaded once per sweep; every breach and handler-less warning goes here.
  readonly adminIds: readonly string[];
}

const assigneeIdsOf = async (
  transaction: Transaction,
  taskId: string
): Promise<string[]> => {
  const assignees = await transaction.orm.public.TaskAssignee.where({ taskId })
    .select("userId")
    .all();
  return assignees.map(({ userId }) => userId);
};

// Whoever should hear a warning: the assignee, or the company's handlers
// while nobody has picked the bug (the admins if it has none).
const warningRecipients = async (
  transaction: Transaction,
  context: SweepContext
): Promise<readonly string[]> => {
  const assignees = await assigneeIdsOf(transaction, context.bug.taskId);
  if (assignees.length > 0) {
    return assignees;
  }
  const handlers = context.bug.clientCompanyId
    ? await transaction.orm.public.ClientCompanyHandler.where({
        companyId: context.bug.clientCompanyId,
      })
        .select("employeeId")
        .all()
    : [];
  const active = handlers.length
    ? await transaction.orm.public.User.where((user) =>
        and(
          user.id.in(handlers.map(({ employeeId }) => employeeId)),
          user.deactivatedAt.isNull()
        )
      )
        .select("id")
        .all()
    : [];
  return active.length > 0 ? active.map(({ id }) => id) : context.adminIds;
};

const notifySla = async (
  transaction: Transaction,
  context: SweepContext,
  recipientIds: readonly string[],
  text: string
): Promise<void> => {
  await notifyUsers(transaction, {
    actorId: null,
    now: context.now,
    projectId: context.bug.projectId,
    recipientIds,
    snippet: context.title,
    taskId: context.bug.taskId,
    text,
    type: "sla",
    url: `/bugs/${context.bug.id}`,
  });
};

type ClockName = "response" | "resolution";

// Flags are claimed with a guarded update, so a warning or breach goes out
// once even if two sweeps overlap.
const claimFlag = async (
  transaction: Transaction,
  bugId: string,
  flags: Record<string, boolean>,
  guard:
    | "warnedResponse"
    | "warnedResolution"
    | "breachedResponse"
    | "breachedResolution",
  now: Date
): Promise<boolean> => {
  const claimed = await transaction.orm.public.BugSla.where({
    bugId,
    [guard]: false,
  }).updateAndCount({ ...flags, updatedAt: now });
  return claimed > 0;
};

const sweepClock = async (
  transaction: Transaction,
  context: SweepContext,
  clock: ClockName
): Promise<number> => {
  const { sla, settings, now } = context;
  const response = clock === "response";
  const start = response ? sla.createdAt : sla.resolutionStartedAt;
  const dueAt = response ? sla.firstResponseDueAt : sla.resolutionDueAt;
  const spentOnPause = response ? 0 : sla.pausedBusinessMs;
  const total =
    businessElapsedMs(start, dueAt, settings.calendar) - spentOnPause;
  const elapsed =
    businessElapsedMs(start, now, settings.calendar) - spentOnPause;
  const label = response ? "first response" : "resolution";

  if (now.getTime() >= dueAt.getTime()) {
    const claimed = await claimFlag(
      transaction,
      sla.bugId,
      response
        ? { breachedResponse: true, warnedResponse: true }
        : { breachedResolution: true, warnedResolution: true },
      response ? "breachedResponse" : "breachedResolution",
      now
    );
    if (!claimed) {
      return 0;
    }
    const assignees = await assigneeIdsOf(transaction, context.bug.taskId);
    await notifySla(
      transaction,
      context,
      [...assignees, ...context.adminIds],
      `${context.key} breached its ${label} target`
    );
    return 1;
  }
  const warned = response ? sla.warnedResponse : sla.warnedResolution;
  if (!warned && total > 0 && elapsed >= WARNING_RATIO * total) {
    const claimed = await claimFlag(
      transaction,
      sla.bugId,
      response ? { warnedResponse: true } : { warnedResolution: true },
      response ? "warnedResponse" : "warnedResolution",
      now
    );
    if (!claimed) {
      return 0;
    }
    await notifySla(
      transaction,
      context,
      await warningRecipients(transaction, context),
      `${context.key} is at 75% of its ${label} target`
    );
    return 1;
  }
  return 0;
};

const sweepBug = async (
  transaction: Transaction,
  context: SweepContext
): Promise<number> => {
  const { sla } = context;
  let notices = 0;
  // A bug that left the queue unanswered (withdrawn, merged, closed) no
  // longer owes a first response.
  if (!(sla.firstRespondedAt || sla.resolvedAt || sla.breachedResponse)) {
    notices += await sweepClock(transaction, context, "response");
  }
  if (!sla.resolvedAt && !sla.pausedAt && !sla.breachedResolution) {
    notices += await sweepClock(transaction, context, "resolution");
  }
  return notices;
};

// Checks every open clock; warns at 75% of the target and alerts on breach.
// Returns how many notices went out.
export const runSlaSweep = async (
  transaction: Transaction,
  now: Date
): Promise<number> => {
  const open = await transaction.orm.public.BugSla.where((sla) =>
    or(
      and(
        sla.firstRespondedAt.isNull(),
        sla.resolvedAt.isNull(),
        sla.breachedResponse.eq(false)
      ),
      and(
        sla.resolvedAt.isNull(),
        sla.pausedAt.isNull(),
        sla.breachedResolution.eq(false)
      )
    )
  )
    .limit(500)
    .all();
  if (open.length === 0) {
    return 0;
  }
  const [settings, bugs] = await Promise.all([
    loadSlaSettings(transaction),
    transaction.orm.public.BugReport.where((bug) =>
      bug.id.in(open.map(({ bugId }) => bugId))
    )
      .select("id", "clientCompanyId", "taskId", "projectId")
      .all(),
  ]);
  const bugById = new Map(bugs.map((bug) => [bug.id, bug]));
  const tasks = await transaction.orm.public.Task.where((task) =>
    task.id.in(bugs.map(({ taskId }) => taskId))
  )
    .select("id", "title", "projectId", "projectTaskNumber", "archivedAt")
    .all();
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const projects = await transaction.orm.public.Project.where((project) =>
    project.id.in([...new Set(bugs.map(({ projectId }) => projectId))])
  )
    .select("id", "key")
    .all();
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const adminIds = await activeAdminIds(transaction);
  // Bugs touch only their own SLA row and notices, so they are swept
  // together; the clocks within one bug still run in turn.
  const notices = await Promise.all(
    open.map((sla) => {
      const bug = bugById.get(sla.bugId);
      const task = bug ? taskById.get(bug.taskId) : undefined;
      const project = bug ? projectById.get(bug.projectId) : undefined;
      if (!bug || !task || !project || task.archivedAt) {
        return 0;
      }
      return sweepBug(transaction, {
        adminIds,
        bug,
        key: keyOf(project, task),
        now,
        settings,
        sla,
        title: task.title,
      });
    })
  );
  return notices.reduce((total, count) => total + count, 0);
};

// The sweep runs every five minutes; one job per interval keeps a busy
// scheduler from queueing it twice.
export const slaSweepDedupeKey = (at: Date): string =>
  `${SLA_SWEEP_JOB}:${Math.floor(at.getTime() / SLA_SWEEP_INTERVAL_MS)}`;

export const enqueueSlaSweep = async (
  transaction: Pick<Transaction, "orm">,
  at: Date
): Promise<void> => {
  const dedupeKey = slaSweepDedupeKey(at);
  await transaction.orm.public.Job.upsert({
    conflictOn: { dedupeKey },
    create: {
      availableAt: at,
      createdAt: at,
      dedupeKey,
      id: randomUUID(),
      kind: SLA_SWEEP_JOB,
      payload: {},
      updatedAt: at,
    },
    update: { updatedAt: at },
  });
};
