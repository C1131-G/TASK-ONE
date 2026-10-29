import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { evaluateBudgetAlerts } from "../budgets/project-budgets";
import { AppError } from "../core/action-result";
import { CalendarDateSchema, UUIDSchema } from "../core/input-schemas";
import { isUniqueConstraintViolation } from "../core/prisma-errors";
import {
  addDays,
  buildProjectReport,
  formatTimeCsv,
  sumMinutes,
  weekDates,
  weekStartOf,
} from "./time-report";
import type {
  ProjectTimeReport,
  TimeEntryView,
  TimeTotals,
} from "./time-report";

const MAX_ENTRY_MINUTES = 1440;
const MAX_NOTE_LENGTH = 500;
const MS_PER_MINUTE = 60_000;
const MAX_REPORT_ROWS = 20_000;
const MAX_TASK_OPTIONS = 100;
const MAX_REPORT_DAYS = 366;
const DEFAULT_TIME_ZONE = "UTC";

const isUuid = Schema.is(UUIDSchema);
const isCalendarDate = Schema.is(CalendarDateSchema);

export interface TimeEntryInput {
  readonly billable: boolean;
  readonly minutes: number;
  readonly note: string | null;
  readonly taskId: string;
  readonly workDate: string;
}

export type TimeEntryChanges = Omit<TimeEntryInput, "taskId">;

export interface StartTimerInput {
  readonly billable: boolean;
  readonly note: string | null;
  readonly taskId: string;
}

export interface RunningTimer {
  readonly billable: boolean;
  readonly note: string | null;
  readonly startedAt: string;
  readonly taskId: string;
  readonly taskReference: string;
  readonly taskTitle: string;
}

export interface StartedTimer {
  // The entry saved from the timer that was running before, if any.
  readonly stopped: TimeEntryView | null;
  readonly timer: RunningTimer;
}

export interface TaskTime extends TimeTotals {
  readonly entries: readonly TimeEntryView[];
}

export interface WeeklyTime extends TimeTotals {
  readonly days: readonly { readonly date: string; readonly minutes: number }[];
  readonly entries: readonly TimeEntryView[];
  readonly weekStart: string;
}

export interface TaskOption {
  readonly reference: string;
  readonly taskId: string;
  readonly title: string;
}

export interface DateRange {
  readonly from: string;
  readonly to: string;
}

const unavailable = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  // A second timer for the same person is refused by the table's key.
  if (isUniqueConstraintViolation(error)) {
    return new AppError({
      code: "CONFLICT",
      message: "A timer is already running.",
    });
  }
  return new AppError({
    code: "UNAVAILABLE",
    message: "Time could not be loaded or saved.",
  });
};

const invalid = (field: string, message: string): AppError =>
  new AppError({ code: "VALIDATION_FAILED", field, message });

const notFound = (what: string): AppError =>
  new AppError({ code: "NOT_FOUND", message: `${what} was not found.` });

interface Actor {
  readonly id: string;
  readonly role: "admin" | "employee";
}

// Same gate as the task pages. Clients never reach internal time data.
const requireWorkspaceUser = async (actorId: string): Promise<Actor> => {
  const actor = await db.orm.public.User.where({ id: actorId })
    .select("deactivatedAt", "mustChangePassword", "role")
    .first();
  if (!actor || actor.deactivatedAt || actor.role === "client") {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (actor.mustChangePassword) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Change your password before continuing.",
    });
  }
  return { id: actorId, role: actor.role === "admin" ? "admin" : "employee" };
};

const validateChanges = (changes: TimeEntryChanges): void => {
  if (
    !Number.isInteger(changes.minutes) ||
    changes.minutes < 1 ||
    changes.minutes > MAX_ENTRY_MINUTES
  ) {
    throw invalid("minutes", "Enter whole minutes between 1 and 1440.");
  }
  if (!isCalendarDate(changes.workDate)) {
    throw invalid("workDate", "Enter a real date.");
  }
  if (changes.note !== null && changes.note.length > MAX_NOTE_LENGTH) {
    throw invalid("note", "Keep the note under 500 characters.");
  }
};

const requireOpenTask = async (taskId: string): Promise<void> => {
  const task = isUuid(taskId)
    ? await db.orm.public.Task.where({ id: taskId })
        .select("archivedAt", "projectId")
        .first()
    : null;
  if (!task) {
    throw notFound("The task");
  }
  const project = await db.orm.public.Project.where({ id: task.projectId })
    .select("archivedAt")
    .first();
  if (task.archivedAt || project?.archivedAt) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Time cannot be logged on archived work.",
    });
  }
};

interface TaskLabel {
  readonly projectId: string;
  readonly reference: string;
  readonly title: string;
}

const loadTaskLabels = async (
  taskIds: readonly string[]
): Promise<ReadonlyMap<string, TaskLabel>> => {
  if (taskIds.length === 0) {
    return new Map();
  }
  const tasks = await db.orm.public.Task.where((task) =>
    task.id.in([...new Set(taskIds)])
  )
    .select("id", "projectId", "projectTaskNumber", "title")
    .all();
  const projects = await db.orm.public.Project.where((project) =>
    project.id.in([...new Set(tasks.map(({ projectId }) => projectId))])
  )
    .select("id", "key")
    .all();
  const keys = new Map(projects.map(({ id, key }) => [id, key]));
  return new Map(
    tasks.map((task) => [
      task.id,
      {
        projectId: task.projectId,
        reference: `${keys.get(task.projectId) ?? ""}-${task.projectTaskNumber}`,
        title: task.title,
      },
    ])
  );
};

interface EntryRow {
  readonly billable: boolean;
  readonly id: string;
  readonly minutes: number;
  readonly note: string | null;
  readonly taskId: string;
  readonly userId: string;
  readonly workDate: string;
}

const toViews = async (
  rows: readonly EntryRow[]
): Promise<readonly TimeEntryView[]> => {
  const labels = await loadTaskLabels(rows.map(({ taskId }) => taskId));
  const userIds = [...new Set(rows.map(({ userId }) => userId))];
  const users =
    userIds.length === 0
      ? []
      : await db.orm.public.User.where((user) => user.id.in(userIds))
          .select("id", "name")
          .all();
  const names = new Map(users.map(({ id, name }) => [id, name]));
  return rows.map((row) => ({
    billable: row.billable,
    id: row.id,
    minutes: row.minutes,
    note: row.note,
    taskId: row.taskId,
    taskReference: labels.get(row.taskId)?.reference ?? "",
    taskTitle: labels.get(row.taskId)?.title ?? "",
    userId: row.userId,
    userName: names.get(row.userId) ?? "",
    workDate: row.workDate,
  }));
};

const viewOf = async (row: EntryRow): Promise<TimeEntryView> => {
  const [view] = await toViews([row]);
  if (!view) {
    throw notFound("The time entry");
  }
  return view;
};

// Logging time can cross a project's budget threshold. The entry is already
// saved, so a failed budget check must not fail the person's time.
const checkBudget = async (taskId: string, now: Date): Promise<void> => {
  try {
    const task = await db.orm.public.Task.where({ id: taskId })
      .select("projectId")
      .first();
    if (task) {
      await evaluateBudgetAlerts(task.projectId, now);
    }
  } catch {
    // The next logged entry evaluates the budget again.
  }
};

const companyDate = async (at: Date): Promise<string> => {
  const settings = await db.orm.public.CompanySettings.where({ id: "company" })
    .select("timeZone")
    .first();
  // en-CA formats a date as YYYY-MM-DD.
  return at.toLocaleDateString("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: settings?.timeZone ?? DEFAULT_TIME_ZONE,
    year: "numeric",
  });
};

interface TimerRow {
  readonly billable: boolean;
  readonly note: string | null;
  readonly startedAt: Date;
  readonly taskId: string;
  readonly userId: string;
}

// Turns the running timer into a saved entry and clears it. A few seconds
// still count as a minute, and one entry never exceeds a day.
const saveTimer = async (
  timer: TimerRow,
  now: Date
): Promise<TimeEntryView> => {
  const elapsed = Math.ceil(
    (now.getTime() - timer.startedAt.getTime()) / MS_PER_MINUTE
  );
  const row = await db.transaction(async (transaction) => {
    // Only the request that actually removes the timer may save its entry, so
    // two stops (or a stop and a start) racing for the same timer save one.
    const removed = await transaction.orm.public.TimeTimer.where({
      startedAt: timer.startedAt,
      userId: timer.userId,
    }).deleteAndCount();
    if (removed === 0) {
      throw new AppError({
        code: "CONFLICT",
        message: "This timer was already stopped.",
      });
    }
    return await transaction.orm.public.TimeEntry.create({
      billable: timer.billable,
      createdAt: now,
      id: randomUUID(),
      minutes: Math.min(Math.max(elapsed, 1), MAX_ENTRY_MINUTES),
      note: timer.note,
      taskId: timer.taskId,
      updatedAt: now,
      userId: timer.userId,
      workDate: await companyDate(timer.startedAt),
    });
  });
  await checkBudget(timer.taskId, now);
  return await viewOf(row);
};

const timerView = async (timer: TimerRow): Promise<RunningTimer> => {
  const labels = await loadTaskLabels([timer.taskId]);
  const label = labels.get(timer.taskId);
  return {
    billable: timer.billable,
    note: timer.note,
    startedAt: timer.startedAt.toISOString(),
    taskId: timer.taskId,
    taskReference: label?.reference ?? "",
    taskTitle: label?.title ?? "",
  };
};

const startTimer = (actorId: string, input: StartTimerInput, now: Date) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<StartedTimer> => {
      await requireWorkspaceUser(actorId);
      if (input.note !== null && input.note.length > MAX_NOTE_LENGTH) {
        throw invalid("note", "Keep the note under 500 characters.");
      }
      await requireOpenTask(input.taskId);
      const current = await db.orm.public.TimeTimer.where({
        userId: actorId,
      }).first();
      if (current?.taskId === input.taskId) {
        return { stopped: null, timer: await timerView(current) };
      }
      const stopped = current ? await saveTimer(current, now) : null;
      const created = await db.orm.public.TimeTimer.create({
        billable: input.billable,
        note: input.note,
        startedAt: now,
        taskId: input.taskId,
        userId: actorId,
      });
      return { stopped, timer: await timerView(created) };
    },
  });

const stopTimer = (actorId: string, now: Date) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<TimeEntryView> => {
      await requireWorkspaceUser(actorId);
      const current = await db.orm.public.TimeTimer.where({
        userId: actorId,
      }).first();
      if (!current) {
        throw notFound("A running timer");
      }
      return await saveTimer(current, now);
    },
  });

const runningTimer = (actorId: string) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<RunningTimer | null> => {
      await requireWorkspaceUser(actorId);
      const current = await db.orm.public.TimeTimer.where({
        userId: actorId,
      }).first();
      return current ? await timerView(current) : null;
    },
  });

const addEntry = (actorId: string, input: TimeEntryInput) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<TimeEntryView> => {
      await requireWorkspaceUser(actorId);
      validateChanges(input);
      await requireOpenTask(input.taskId);
      const now = new Date();
      const row = await db.orm.public.TimeEntry.create({
        billable: input.billable,
        createdAt: now,
        id: randomUUID(),
        minutes: input.minutes,
        note: input.note,
        taskId: input.taskId,
        updatedAt: now,
        userId: actorId,
        workDate: input.workDate,
      });
      await checkBudget(input.taskId, now);
      return await viewOf(row);
    },
  });

// People change their own entries; administrators may change anyone's.
const requireOwnEntry = async (actor: Actor, entryId: string) => {
  const entry = isUuid(entryId)
    ? await db.orm.public.TimeEntry.where({ id: entryId }).first()
    : null;
  if (!entry) {
    throw notFound("The time entry");
  }
  if (entry.userId !== actor.id && actor.role !== "admin") {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You can only change your own time entries.",
    });
  }
  return entry;
};

const updateEntry = (
  actorId: string,
  entryId: string,
  changes: TimeEntryChanges
) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<TimeEntryView> => {
      const actor = await requireWorkspaceUser(actorId);
      validateChanges(changes);
      await requireOwnEntry(actor, entryId);
      const row = await db.orm.public.TimeEntry.where({ id: entryId }).update({
        billable: changes.billable,
        minutes: changes.minutes,
        note: changes.note,
        updatedAt: new Date(),
        workDate: changes.workDate,
      });
      if (!row) {
        throw notFound("The time entry");
      }
      await checkBudget(row.taskId, new Date());
      return await viewOf(row);
    },
  });

const deleteEntry = (actorId: string, entryId: string) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<void> => {
      const actor = await requireWorkspaceUser(actorId);
      await requireOwnEntry(actor, entryId);
      await db.orm.public.TimeEntry.where({ id: entryId }).delete();
    },
  });

const taskTime = (actorId: string, taskId: string) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<TaskTime> => {
      await requireWorkspaceUser(actorId);
      if (!isUuid(taskId)) {
        throw notFound("The task");
      }
      const rows = await db.orm.public.TimeEntry.where({ taskId })
        .orderBy((entry) => entry.workDate.desc())
        .limit(MAX_REPORT_ROWS)
        .all();
      const entries = await toViews(rows);
      return { ...sumMinutes(entries), entries };
    },
  });

const weeklyTime = (actorId: string, date: string) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<WeeklyTime> => {
      await requireWorkspaceUser(actorId);
      if (!isCalendarDate(date)) {
        throw invalid("weekStart", "Enter a real date.");
      }
      const weekStart = weekStartOf(date);
      const weekEnd = addDays(weekStart, 6);
      const rows = await db.orm.public.TimeEntry.where((entry) =>
        and(
          entry.userId.eq(actorId),
          entry.workDate.gte(weekStart),
          entry.workDate.lte(weekEnd)
        )
      )
        .orderBy((entry) => entry.workDate.asc())
        .orderBy((entry) => entry.createdAt.asc())
        .all();
      const entries = await toViews(rows);
      return {
        ...sumMinutes(entries),
        days: weekDates(weekStart).map((day) => ({
          date: day,
          minutes: entries
            .filter((entry) => entry.workDate === day)
            .reduce((sum, entry) => sum + entry.minutes, 0),
        })),
        entries,
        weekStart,
      };
    },
  });

// Open tasks assigned to the person, the ones they are most likely to log time on.
const assignedTasks = (actorId: string) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<readonly TaskOption[]> => {
      await requireWorkspaceUser(actorId);
      const assignments = await db.orm.public.TaskAssignee.where({
        userId: actorId,
      })
        .select("taskId")
        .all();
      if (assignments.length === 0) {
        return [];
      }
      const tasks = await db.orm.public.Task.where((task) =>
        and(
          task.id.in(assignments.map(({ taskId }) => taskId)),
          task.archivedAt.isNull(),
          task.status.neq("done")
        )
      )
        .select("id")
        .orderBy((task) => task.updatedAt.desc())
        .limit(MAX_TASK_OPTIONS)
        .all();
      const labels = await loadTaskLabels(tasks.map(({ id }) => id));
      return tasks.flatMap(({ id }) => {
        const label = labels.get(id);
        return label
          ? [{ reference: label.reference, taskId: id, title: label.title }]
          : [];
      });
    },
  });

const validateRange = (range: DateRange): void => {
  if (!isCalendarDate(range.from) || !isCalendarDate(range.to)) {
    throw invalid("from", "Enter real dates.");
  }
  if (range.from > range.to) {
    throw invalid("from", "The start date must be on or before the end date.");
  }
  if (addDays(range.from, MAX_REPORT_DAYS) < range.to) {
    throw invalid("to", "Report on at most a year at a time.");
  }
};

// Administrators and members of the project may read its time.
const loadProjectEntries = async (
  actorId: string,
  projectId: string,
  range: DateRange
): Promise<readonly TimeEntryView[]> => {
  const actor = await requireWorkspaceUser(actorId);
  validateRange(range);
  const project = isUuid(projectId)
    ? await db.orm.public.Project.where({ id: projectId }).select("id").first()
    : null;
  if (!project) {
    throw notFound("The project");
  }
  if (actor.role !== "admin") {
    const membership = await db.orm.public.ProjectMember.where({
      projectId,
      userId: actorId,
    }).first();
    if (!membership) {
      throw new AppError({
        code: "FORBIDDEN",
        message:
          "Only administrators and project members can see project time.",
      });
    }
  }
  const tasks = await db.orm.public.Task.where({ projectId })
    .select("id")
    .all();
  if (tasks.length === 0) {
    return [];
  }
  const rows = await db.orm.public.TimeEntry.where((entry) =>
    and(
      entry.taskId.in(tasks.map(({ id }) => id)),
      entry.workDate.gte(range.from),
      entry.workDate.lte(range.to)
    )
  )
    .orderBy((entry) => entry.workDate.asc())
    .limit(MAX_REPORT_ROWS)
    .all();
  return await toViews(rows);
};

const projectReport = (actorId: string, projectId: string, range: DateRange) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<ProjectTimeReport> =>
      buildProjectReport(
        await loadProjectEntries(actorId, projectId, range),
        range
      ),
  });

const projectReportCsv = (
  actorId: string,
  projectId: string,
  range: DateRange
) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<string> =>
      formatTimeCsv(await loadProjectEntries(actorId, projectId, range)),
  });

export class TimeTracking extends Context.Service<
  TimeTracking,
  {
    readonly startTimer: (
      actorId: string,
      input: StartTimerInput,
      now: Date
    ) => Effect.Effect<StartedTimer, AppError>;
    readonly stopTimer: (
      actorId: string,
      now: Date
    ) => Effect.Effect<TimeEntryView, AppError>;
    readonly runningTimer: (
      actorId: string
    ) => Effect.Effect<RunningTimer | null, AppError>;
    readonly addEntry: (
      actorId: string,
      input: TimeEntryInput
    ) => Effect.Effect<TimeEntryView, AppError>;
    readonly updateEntry: (
      actorId: string,
      entryId: string,
      changes: TimeEntryChanges
    ) => Effect.Effect<TimeEntryView, AppError>;
    readonly deleteEntry: (
      actorId: string,
      entryId: string
    ) => Effect.Effect<void, AppError>;
    readonly taskTime: (
      actorId: string,
      taskId: string
    ) => Effect.Effect<TaskTime, AppError>;
    readonly weeklyTime: (
      actorId: string,
      date: string
    ) => Effect.Effect<WeeklyTime, AppError>;
    readonly assignedTasks: (
      actorId: string
    ) => Effect.Effect<readonly TaskOption[], AppError>;
    readonly projectReport: (
      actorId: string,
      projectId: string,
      range: DateRange
    ) => Effect.Effect<ProjectTimeReport, AppError>;
    readonly projectReportCsv: (
      actorId: string,
      projectId: string,
      range: DateRange
    ) => Effect.Effect<string, AppError>;
  }
>()("taskora/server/TimeTracking") {}

export const TimeTrackingLive = Layer.succeed(TimeTracking, {
  addEntry,
  assignedTasks,
  deleteEntry,
  projectReport,
  projectReportCsv,
  runningTimer,
  startTimer,
  stopTimer,
  taskTime,
  updateEntry,
  weeklyTime,
});
