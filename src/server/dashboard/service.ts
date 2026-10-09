import { and } from "@prisma/orm-postgres/orm-client";
import { Context, Effect, Layer } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";

export interface DashboardOverview {
  readonly projects: {
    readonly active: number;
    readonly planning: number;
    readonly risk: number;
    readonly hold: number;
    readonly complete: number;
  };
  readonly tasks: {
    readonly backlog: number;
    readonly todo: number;
    readonly progress: number;
    readonly review: number;
    readonly done: number;
  };
  readonly overdueCount: number;
  readonly workload: readonly {
    readonly employeeId: string;
    readonly employeeName: string;
    readonly openTaskCount: number;
  }[];
}

export class Dashboard extends Context.Service<
  Dashboard,
  {
    readonly getOverview: (
      userId: string
    ) => Effect.Effect<DashboardOverview, AppError>;
  }
>()("metsys/server/Dashboard") {}

const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The dashboard could not be loaded.",
      });

const getOverview = (
  userId: string
): Effect.Effect<DashboardOverview, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      const actor = await db.orm.public.User.where({ id: userId })
        .select("deactivatedAt", "mustChangePassword")
        .first();
      if (!actor || actor.deactivatedAt) {
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

      const [projects, tasks, employees] = await Promise.all([
        db.orm.public.Project.where({ archivedAt: null })
          .select("status")
          .all(),
        db.orm.public.Task.where({ archivedAt: null })
          .include("project")
          .select("id", "status", "dueDate")
          .all(),
        db.orm.public.User.where((user) =>
          and(user.deactivatedAt.isNull(), user.mustChangePassword.eq(false))
        )
          .select("id", "name")
          .all(),
      ]);
      const activeTasks = [];
      const openTaskIds: string[] = [];
      for (const task of tasks) {
        if (task.project.archivedAt !== null) {
          continue;
        }
        activeTasks.push(task);
        if (task.status !== "done") {
          openTaskIds.push(task.id);
        }
      }
      const assignments =
        openTaskIds.length === 0
          ? []
          : await db.orm.public.TaskAssignee.where((assignment) =>
              assignment.taskId.in(openTaskIds)
            )
              .select("taskId", "userId")
              .all();
      const workloadByEmployee = new Map<string, Set<string>>();
      for (const assignment of assignments) {
        const assigned = workloadByEmployee.get(assignment.userId) ?? new Set();
        assigned.add(assignment.taskId);
        workloadByEmployee.set(assignment.userId, assigned);
      }
      const today = new Date().toISOString().slice(0, 10);
      const projectCounts = {
        active: 0,
        complete: 0,
        hold: 0,
        planning: 0,
        risk: 0,
      };
      for (const project of projects) {
        projectCounts[project.status] += 1;
      }
      const taskCounts = {
        backlog: 0,
        done: 0,
        progress: 0,
        review: 0,
        todo: 0,
      };
      let overdueCount = 0;
      for (const task of activeTasks) {
        taskCounts[task.status] += 1;
        if (task.status !== "done" && task.dueDate && task.dueDate < today) {
          overdueCount += 1;
        }
      }
      return {
        overdueCount,
        projects: projectCounts,
        tasks: taskCounts,
        workload: employees
          .map((employee) => ({
            employeeId: employee.id,
            employeeName: employee.name,
            openTaskCount: workloadByEmployee.get(employee.id)?.size ?? 0,
          }))
          .toSorted((left, right) =>
            left.employeeName.localeCompare(right.employeeName)
          ),
      };
    },
  });

export const DashboardLive = Layer.succeed(
  Dashboard,
  Dashboard.of({ getOverview })
);
