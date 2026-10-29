import { and, or } from "@prisma/orm-postgres/orm-client";
import { Context, Effect, Layer } from "effect";

import { db } from "@/src/prisma/db";

import { companyToday } from "../budgets/budget-math";
import { AppError } from "../core/action-result";
import {
  WEEKLY_CAPACITY_HOURS,
  WORKLOAD_WEEKS,
  aggregateWorkload,
  weekStartsFrom,
} from "./workload-math";
import type { WorkloadView } from "./workload-math";

const DEFAULT_TIME_ZONE = "UTC";
const DAYS_PER_WEEK = 7;
const DAY_MS = 86_400_000;
const OPEN_STATUSES = ["backlog", "todo", "progress", "review"] as const;

const unavailable = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "Workload could not be loaded.",
      });

// Same gate as budgets and time: staff only, clients never reach it.
const requireStaff = async (actorId: string): Promise<void> => {
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
};

const companyTimeZone = async (): Promise<string> => {
  const settings = await db.orm.public.CompanySettings.where({ id: "company" })
    .select("timeZone")
    .first();
  return settings?.timeZone ?? DEFAULT_TIME_ZONE;
};

const staffPeople = async () => {
  const users = await db.orm.public.User.where((user) =>
    and(user.deactivatedAt.isNull(), user.role.in(["admin", "employee"]))
  )
    .select("id", "name")
    .all();
  return users.map(({ id, name }) => ({ id, name }));
};

const loadWorkload = async (now: Date): Promise<WorkloadView> => {
  const today = companyToday(now, await companyTimeZone());
  const weekStarts = weekStartsFrom(today, WORKLOAD_WEEKS);
  const firstWeek = weekStarts[0] ?? today;
  const horizon = new Date(
    Date.parse(`${firstWeek}T00:00:00Z`) +
      WORKLOAD_WEEKS * DAYS_PER_WEEK * DAY_MS
  )
    .toISOString()
    .slice(0, 10);
  const [people, projects] = await Promise.all([
    staffPeople(),
    db.orm.public.Project.where({ archivedAt: null }).select("id").all(),
  ]);
  if (projects.length === 0) {
    return aggregateWorkload({
      capacityHours: WEEKLY_CAPACITY_HOURS,
      people,
      tasks: [],
      today,
    });
  }
  const rows = await db.orm.public.Task.where((task) =>
    and(
      task.projectId.in(projects.map(({ id }) => id)),
      task.archivedAt.isNull(),
      task.status.in([...OPEN_STATUSES]),
      or(task.dueDate.isNull(), task.dueDate.lt(horizon))
    )
  )
    .select("id", "dueDate", "estimate", "priority", "status")
    .all();
  const assignments =
    rows.length === 0
      ? []
      : await db.orm.public.TaskAssignee.where((assignment) =>
          assignment.taskId.in(rows.map(({ id }) => id))
        )
          .select("taskId", "userId")
          .all();
  const assigneesByTask = new Map<string, string[]>();
  for (const { taskId, userId } of assignments) {
    assigneesByTask.set(taskId, [
      ...(assigneesByTask.get(taskId) ?? []),
      userId,
    ]);
  }
  return aggregateWorkload({
    capacityHours: WEEKLY_CAPACITY_HOURS,
    people,
    tasks: rows.map((row) => ({
      assigneeIds: assigneesByTask.get(row.id) ?? [],
      dueDate: row.dueDate,
      estimate: row.estimate,
      id: row.id,
      priority: row.priority,
      status: row.status,
    })),
    today,
  });
};

const view = (actorId: string, now: Date) =>
  Effect.tryPromise({
    catch: unavailable,
    try: async (): Promise<WorkloadView> => {
      await requireStaff(actorId);
      return await loadWorkload(now);
    },
  });

export class TeamWorkload extends Context.Service<
  TeamWorkload,
  {
    readonly view: (
      actorId: string,
      now: Date
    ) => Effect.Effect<WorkloadView, AppError>;
  }
>()("taskora/server/TeamWorkload") {}

export const TeamWorkloadLive = Layer.succeed(TeamWorkload, { view });
