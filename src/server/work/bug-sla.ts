import { randomUUID } from "node:crypto";

import { and, or } from "@prisma/orm-postgres/orm-client";

import type { ImpactKey, SlaSettings } from "../company/sla-settings";
import { loadSlaSettings } from "../company/sla-settings";
import { activeAdminIds, notifyUsers } from "../notifications/notify-users";
import { businessDeadline, businessElapsedMs } from "./business-time";
import type { Transaction } from "./work-internal";

export const SLA_SWEEP_JOB = "bug.sla_sweep";
export const SLA_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const WARNING_RATIO = 0.75;
const MAX_INT = 2_147_483_647;
const MINUTE_MS = 60_000;

// Statuses where the team has done its part (or the clock no longer applies).
const RESOLVING_STATUSES = new Set([
  "awaiting_client",
  "closed",
  "duplicate",
  "withdrawn",
]);

export type SlaClockState =
  | "ok"
  | "warning"
  | "breached"
  | "met"
  | "missed"
  | "paused";

export interface SlaClockView {
  readonly dueAt: string;
  readonly state: SlaClockState;
  // Business minutes until the due time; negative once it is overdue.
  readonly minutesLeft: number | null;
}

export interface SlaView {
  readonly firstResponse: SlaClockView;
  readonly resolution: SlaClockView;
}

type SlaRow = NonNullable<
  Awaited<ReturnType<Transaction["orm"]["public"]["BugSla"]["first"]>>
>;

const clockView = (input: {
  readonly dueAt: Date;
  readonly doneAt: Date | null;
  readonly paused: boolean;
  readonly warned: boolean;
  readonly breached: boolean;
  readonly settings: SlaSettings;
  readonly now: Date;
}): SlaClockView => {
  const { dueAt, doneAt, now } = input;
  if (doneAt) {
    return {
      dueAt: dueAt.toISOString(),
      minutesLeft: null,
      state: doneAt.getTime() <= dueAt.getTime() ? "met" : "missed",
    };
  }
  const minutesLeft = Math.round(
    businessElapsedMs(now, dueAt, input.settings.calendar) / MINUTE_MS
  );
  let state: SlaClockState = "ok";
  if (input.paused) {
    state = "paused";
  } else if (input.breached || now.getTime() >= dueAt.getTime()) {
    state = "breached";
  } else if (input.warned) {
    state = "warning";
  }
  return { dueAt: dueAt.toISOString(), minutesLeft, state };
};

// What the team sees: the state of both clocks, in business time.
export const buildSlaView = (
  sla: SlaRow,
  settings: SlaSettings,
  now: Date
): SlaView => ({
  firstResponse: clockView({
    breached: sla.breachedResponse,
    // A bug closed or withdrawn before anyone answered stops this clock too.
    doneAt: sla.firstRespondedAt ?? sla.resolvedAt,
    dueAt: sla.firstResponseDueAt,
    now,
    paused: false,
    settings,
    warned: sla.warnedResponse,
  }),
  resolution: clockView({
    breached: sla.breachedResolution,
    doneAt: sla.resolvedAt,
    dueAt: sla.resolutionDueAt,
    now,
    paused: sla.pausedAt !== null,
    settings,
    warned: sla.warnedResolution,
  }),
});

// Starts both clocks when a client report comes in.
export const createBugSla = async (
  transaction: Transaction,
  input: {
    readonly bugId: string;
    readonly impact: ImpactKey;
    readonly now: Date;
  }
): Promise<void> => {
  const settings = await loadSlaSettings(transaction);
  const target = settings.targets[input.impact];
  await transaction.orm.public.BugSla.create({
    bugId: input.bugId,
    createdAt: input.now,
    firstResponseDueAt: businessDeadline(
      input.now,
      target.firstResponseMinutes,
      settings.calendar
    ),
    resolutionDueAt: businessDeadline(
      input.now,
      target.resolutionMinutes,
      settings.calendar
    ),
    resolutionStartedAt: input.now,
    updatedAt: input.now,
  });
};

// The first pick, or the first public reply from the team, is the first response.
export const markFirstResponse = async (
  transaction: Transaction,
  bugId: string,
  now: Date
): Promise<void> => {
  await transaction.orm.public.BugSla.where({
    bugId,
    firstRespondedAt: null,
  }).updateAll({ firstRespondedAt: now, updatedAt: now });
};

const clampInt = (value: number): number =>
  Math.max(0, Math.min(MAX_INT, Math.round(value)));

// Keeps the resolution clock in step with the bug: it pauses while the team
// waits on the client, stops once the team is done, and starts over if the
// bug comes back.
export const slaOnStatusChange = async (
  transaction: Transaction,
  input: {
    readonly bugId: string;
    readonly from: string;
    readonly to: string;
    readonly now: Date;
  }
): Promise<void> => {
  const sla = await transaction.orm.public.BugSla.where({
    bugId: input.bugId,
  }).first();
  if (!sla) {
    return;
  }
  const settings = await loadSlaSettings(transaction);
  const { now, to } = input;
  let patch: Record<string, unknown> = {};
  let dueAt = sla.resolutionDueAt;
  let { pausedBusinessMs } = sla;
  let { pausedAt } = sla;

  if (input.from === "needs_info" && pausedAt) {
    const elapsed = Math.max(
      0,
      businessElapsedMs(pausedAt, now, settings.calendar)
    );
    pausedBusinessMs = clampInt(pausedBusinessMs + elapsed);
    dueAt = businessDeadline(dueAt, elapsed / MINUTE_MS, settings.calendar);
    pausedAt = null;
    patch = { pausedAt: null, pausedBusinessMs, resolutionDueAt: dueAt };
  }

  if (RESOLVING_STATUSES.has(to)) {
    if (!sla.resolvedAt) {
      patch = { ...patch, resolvedAt: now };
    }
  } else if (sla.resolvedAt) {
    // The bug came back after being handed over or closed.
    const bug = await transaction.orm.public.BugReport.where({
      id: input.bugId,
    })
      .select("clientImpact")
      .first();
    const target = settings.targets[bug?.clientImpact ?? "medium"];
    patch = {
      ...patch,
      breachedResolution: false,
      pausedAt: to === "needs_info" ? now : null,
      pausedBusinessMs: 0,
      resolutionDueAt: businessDeadline(
        now,
        target.resolutionMinutes,
        settings.calendar
      ),
      resolutionStartedAt: now,
      resolvedAt: null,
      warnedResolution: false,
    };
  } else if (to === "needs_info" && !pausedAt) {
    patch = { ...patch, pausedAt: now };
  }

  if (Object.keys(patch).length > 0) {
    await transaction.orm.public.BugSla.where({ bugId: input.bugId }).update({
      ...patch,
      updatedAt: now,
    });
  }
};

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
): Promise<string[]> => {
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
  return active.length > 0
    ? active.map(({ id }) => id)
    : activeAdminIds(transaction);
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
    const admins = await activeAdminIds(transaction);
    await notifySla(
      transaction,
      context,
      [...assignees, ...admins],
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
  let notices = 0;
  for (const sla of open) {
    const bug = bugById.get(sla.bugId);
    const task = bug ? taskById.get(bug.taskId) : undefined;
    const project = bug ? projectById.get(bug.projectId) : undefined;
    if (!bug || !task || !project || task.archivedAt) {
      continue;
    }
    const context: SweepContext = {
      bug,
      key: keyOf(project, task),
      now,
      settings,
      sla,
      title: task.title,
    };
    // A bug that left the queue unanswered (withdrawn, merged, closed) no
    // longer owes a first response.
    if (!(sla.firstRespondedAt || sla.resolvedAt || sla.breachedResponse)) {
      // Each clock claims its own flag, so they run one after the other.
      // eslint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop
      notices += await sweepClock(transaction, context, "response");
    }
    if (!sla.resolvedAt && !sla.pausedAt && !sla.breachedResolution) {
      // eslint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop
      notices += await sweepClock(transaction, context, "resolution");
    }
  }
  return notices;
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
