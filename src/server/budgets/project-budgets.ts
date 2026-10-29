import { and } from "@prisma/orm-postgres/orm-client";
import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { UUIDSchema } from "../core/input-schemas";
import { isUniqueConstraintViolation } from "../core/prisma-errors";
import { activeAdminIds, notifyUsers } from "../notifications/notify-users";
import { budgetPeriod, burnOf } from "./budget-math";
import type { BudgetKind, BudgetPeriod, BurnLevel } from "./budget-math";

const DEFAULT_TIME_ZONE = "UTC";
const MINUTES_PER_HOUR = 60;
const MAX_BUDGET_MINUTES = 6_000_000;
const MAX_WARNING_PERCENT = 100;
const CURRENCY_CODE = /^[A-Z]{3}$/u;

const isUuid = Schema.is(UUIDSchema);

export interface BudgetInput {
  readonly billableOnly: boolean;
  readonly budgetMinutes: number;
  readonly currency: string;
  readonly hourlyRateCents: number | null;
  readonly kind: BudgetKind;
  readonly warningPercent: number;
}

export interface ProjectBudgetView {
  readonly billableOnly: boolean;
  readonly budgetAmountCents: number | null;
  readonly budgetMinutes: number;
  readonly currency: string;
  readonly hourlyRateCents: number | null;
  readonly kind: BudgetKind;
  readonly level: BurnLevel;
  readonly percent: number;
  readonly period: BudgetPeriod;
  readonly projectId: string;
  readonly remainingMinutes: number;
  readonly spentAmountCents: number | null;
  readonly spentMinutes: number;
  readonly warningPercent: number;
}

export interface BudgetListRow extends ProjectBudgetView {
  readonly projectKey: string;
  readonly projectName: string;
}

const unavailable = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "Budgets could not be loaded or saved.",
      });

const invalid = (field: string, message: string): AppError =>
  new AppError({ code: "VALIDATION_FAILED", field, message });

const notFound = (): AppError =>
  new AppError({ code: "NOT_FOUND", message: "The project was not found." });

interface Actor {
  readonly id: string;
  readonly isAdmin: boolean;
}

// Same gate as the time pages. Clients never reach budgets.
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
  return { id: actorId, isAdmin: actor.role === "admin" };
};

const requireAdmin = async (actorId: string): Promise<void> => {
  const actor = await requireWorkspaceUser(actorId);
  if (!actor.isAdmin) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Only administrators can manage budgets.",
    });
  }
};

const validateInput = (input: BudgetInput): void => {
  if (
    !Number.isInteger(input.budgetMinutes) ||
    input.budgetMinutes < 1 ||
    input.budgetMinutes > MAX_BUDGET_MINUTES
  ) {
    throw invalid("budgetMinutes", "Enter a budget of at least one minute.");
  }
  if (
    !Number.isInteger(input.warningPercent) ||
    input.warningPercent < 1 ||
    input.warningPercent > MAX_WARNING_PERCENT
  ) {
    throw invalid("warningPercent", "Enter a warning between 1 and 100%.");
  }
  if (
    input.hourlyRateCents !== null &&
    (!Number.isInteger(input.hourlyRateCents) || input.hourlyRateCents < 0)
  ) {
    throw invalid("hourlyRateCents", "Enter a rate of zero or more.");
  }
  if (!CURRENCY_CODE.test(input.currency)) {
    throw invalid("currency", "Use a three-letter currency code such as USD.");
  }
};

const companyTimeZone = async (): Promise<string> => {
  const settings = await db.orm.public.CompanySettings.where({ id: "company" })
    .select("timeZone")
    .first();
  return settings?.timeZone ?? DEFAULT_TIME_ZONE;
};

const requireProject = async (projectId: string) => {
  const project = isUuid(projectId)
    ? await db.orm.public.Project.where({ id: projectId })
        .select("id", "key", "leadId", "name")
        .first()
    : null;
  if (!project) {
    throw notFound();
  }
  return project;
};

// Minutes logged on the project's tasks inside the period.
const spentMinutesIn = async (
  projectId: string,
  period: BudgetPeriod,
  billableOnly: boolean
): Promise<number> => {
  const tasks = await db.orm.public.Task.where({ projectId })
    .select("id")
    .all();
  if (tasks.length === 0) {
    return 0;
  }
  const totals = await db.orm.public.TimeEntry.where((entry) =>
    and(
      entry.taskId.in(tasks.map(({ id }) => id)),
      ...(period.from === null ? [] : [entry.workDate.gte(period.from)]),
      ...(period.to === null ? [] : [entry.workDate.lte(period.to)]),
      ...(billableOnly ? [entry.billable.eq(true)] : [])
    )
  ).aggregate((aggregates) => ({ total: aggregates.sum("minutes") }));
  return totals.total ?? 0;
};

interface BudgetRow {
  readonly billableOnly: boolean;
  readonly budgetMinutes: number;
  readonly currency: string;
  readonly hourlyRateCents: number | null;
  readonly kind: BudgetKind;
  readonly projectId: string;
  readonly warningPercent: number;
}

const toView = async (
  row: BudgetRow,
  now: Date,
  timeZone: string,
  includeMoney: boolean
): Promise<ProjectBudgetView> => {
  const period = budgetPeriod(row.kind, now, timeZone);
  const spentMinutes = await spentMinutesIn(
    row.projectId,
    period,
    row.billableOnly
  );
  const burn = burnOf({
    budgetMinutes: row.budgetMinutes,
    spentMinutes,
    warningPercent: row.warningPercent,
  });
  const rate = includeMoney ? row.hourlyRateCents : null;
  const amountOf = (minutes: number): number | null =>
    rate === null ? null : Math.round((minutes * rate) / MINUTES_PER_HOUR);
  return {
    billableOnly: row.billableOnly,
    budgetAmountCents: amountOf(row.budgetMinutes),
    budgetMinutes: row.budgetMinutes,
    currency: row.currency,
    hourlyRateCents: rate,
    kind: row.kind,
    level: burn.level,
    percent: burn.percent,
    period,
    projectId: row.projectId,
    remainingMinutes: burn.remainingMinutes,
    spentAmountCents: amountOf(spentMinutes),
    spentMinutes,
    warningPercent: row.warningPercent,
  };
};

const get = (actorId: string, projectId: string, now: Date) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<ProjectBudgetView | null> => {
      const actor = await requireWorkspaceUser(actorId);
      const project = await requireProject(projectId);
      if (!actor.isAdmin && project.leadId !== actorId) {
        const membership = await db.orm.public.ProjectMember.where({
          projectId,
          userId: actorId,
        }).first();
        if (!membership) {
          throw new AppError({
            code: "FORBIDDEN",
            message:
              "Only administrators and members of this project can see its budget.",
          });
        }
      }
      const row = await db.orm.public.ProjectBudget.where({
        projectId,
      }).first();
      return row
        ? await toView(row, now, await companyTimeZone(), actor.isAdmin)
        : null;
    },
  });

const list = (actorId: string, now: Date) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<readonly BudgetListRow[]> => {
      await requireAdmin(actorId);
      const budgets = await db.orm.public.ProjectBudget.all();
      if (budgets.length === 0) {
        return [];
      }
      const [projects, timeZone] = await Promise.all([
        db.orm.public.Project.where((project) =>
          and(
            project.id.in(budgets.map(({ projectId }) => projectId)),
            project.archivedAt.isNull()
          )
        )
          .select("id", "key", "name")
          .all(),
        companyTimeZone(),
      ]);
      const rows = await Promise.all(
        projects.map(async (project) => {
          const budget = budgets.find(
            ({ projectId }) => projectId === project.id
          );
          return budget
            ? [
                {
                  ...(await toView(budget, now, timeZone, true)),
                  projectKey: project.key,
                  projectName: project.name,
                },
              ]
            : [];
        })
      );
      return rows
        .flat()
        .toSorted(
          (left, right) =>
            right.percent - left.percent ||
            left.projectName.localeCompare(right.projectName)
        );
    },
  });

const formatHours = (minutes: number): string => {
  const hours = Math.round((minutes / MINUTES_PER_HOUR) * 10) / 10;
  return `${hours}h`;
};

interface AlertCopy {
  readonly snippet: string;
  readonly text: string;
}

const alertCopy = (
  projectName: string,
  level: "overrun" | "warning",
  view: ProjectBudgetView
): AlertCopy => ({
  snippet: `${formatHours(view.spentMinutes)} of ${formatHours(view.budgetMinutes)} used${
    view.kind === "retainer" ? ` in ${view.period.key}` : ""
  }`,
  text:
    level === "overrun"
      ? `Budget exceeded: ${projectName} is over its hours budget`
      : `Budget warning: ${projectName} has used ${view.percent}% of its hours`,
});

// Records each newly reached level once per period and notifies the
// administrators and the project lead. The (project, period, level) row is the
// dedupe key: a repeat evaluation, or a racing one, finds it and stays quiet.
export const evaluateBudgetAlerts = async (
  projectId: string,
  now: Date
): Promise<void> => {
  const budget = await db.orm.public.ProjectBudget.where({
    projectId,
  }).first();
  if (!budget) {
    return;
  }
  const view = await toView(budget, now, await companyTimeZone(), false);
  const reached: ("overrun" | "warning")[] = [];
  if (view.level !== "ok") {
    reached.push("warning");
  }
  if (view.level === "overrun") {
    reached.push("overrun");
  }
  if (reached.length === 0) {
    return;
  }
  const recorded = await db.orm.public.ProjectBudgetAlert.where({
    periodKey: view.period.key,
    projectId,
  })
    .select("level")
    .all();
  const known = new Set(recorded.map(({ level }) => level));
  const fresh = reached.filter((level) => !known.has(level));
  const loudest = fresh.at(-1);
  if (!loudest) {
    return;
  }
  const project = await requireProject(projectId);
  const copy = alertCopy(project.name, loudest, view);
  try {
    await db.transaction(async (transaction) => {
      await Promise.all(
        fresh.map((level) =>
          transaction.orm.public.ProjectBudgetAlert.create({
            createdAt: now,
            level,
            periodKey: view.period.key,
            projectId,
          })
        )
      );
      const admins = await activeAdminIds(transaction);
      await notifyUsers(transaction, {
        actorId: null,
        now,
        projectId,
        recipientIds: project.leadId ? [...admins, project.leadId] : admins,
        snippet: copy.snippet,
        taskId: null,
        text: copy.text,
        type: "status",
        url: `/projects/${projectId}/time`,
      });
    });
  } catch (error) {
    // A concurrent evaluation claimed the level first and announced it.
    if (!isUniqueConstraintViolation(error)) {
      throw error;
    }
  }
};

const save = (
  actorId: string,
  projectId: string,
  input: BudgetInput,
  now: Date
) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<ProjectBudgetView> => {
      await requireAdmin(actorId);
      validateInput(input);
      await requireProject(projectId);
      const row = await db.orm.public.ProjectBudget.upsert({
        conflictOn: { projectId },
        create: { ...input, createdAt: now, projectId, updatedAt: now },
        update: { ...input, updatedAt: now },
      });
      await evaluateBudgetAlerts(projectId, now);
      return await toView(row, now, await companyTimeZone(), true);
    },
  });

const clear = (actorId: string, projectId: string) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<void> => {
      await requireAdmin(actorId);
      await requireProject(projectId);
      await db.orm.public.ProjectBudget.where({ projectId }).delete();
    },
  });

export class ProjectBudgets extends Context.Service<
  ProjectBudgets,
  {
    readonly get: (
      actorId: string,
      projectId: string,
      now: Date
    ) => Effect.Effect<ProjectBudgetView | null, AppError>;
    readonly list: (
      actorId: string,
      now: Date
    ) => Effect.Effect<readonly BudgetListRow[], AppError>;
    readonly save: (
      actorId: string,
      projectId: string,
      input: BudgetInput,
      now: Date
    ) => Effect.Effect<ProjectBudgetView, AppError>;
    readonly clear: (
      actorId: string,
      projectId: string
    ) => Effect.Effect<void, AppError>;
  }
>()("taskora/server/ProjectBudgets") {}

export const ProjectBudgetsLive = Layer.succeed(ProjectBudgets, {
  clear,
  get,
  list,
  save,
});
