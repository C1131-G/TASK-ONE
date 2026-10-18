import type { ImpactKey, SlaSettings } from "../company/sla-settings";
import { loadSlaSettings } from "../company/sla-settings";
import { businessDeadline, businessElapsedMs } from "./business-time";
import type { Transaction } from "./work-internal";

export const SLA_SWEEP_JOB = "bug.sla_sweep";
export const SLA_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
export const WARNING_RATIO = 0.75;
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

export type SlaRow = NonNullable<
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
