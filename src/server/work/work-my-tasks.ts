import { and } from "@prisma/orm-postgres/orm-client";
import { Effect } from "effect";

import { getUtcToday } from "@/src/lib/utc-today";
import { db } from "@/src/prisma/db";

import type { MobileMyWork } from "../../mobile-api/routes-tasks";
import type { AppError } from "../core/action-result";
import { decodeTaskPriority, decodeTaskStatus } from "./work-contracts";
import { databaseError } from "./work-internal";

export type MyWorkScope = "assigned" | "due" | "overdue";

export interface MyWorkQuery {
  readonly scope: MyWorkScope;
  readonly limit: number;
  readonly offset: number;
}

// Open ordinary tasks the person is assigned to, soonest due first. Bugs
// follow the bug workflow, so they are not listed here. A page holds at most
// `limit` tasks and `nextOffset` names where the next page starts.
export const listMyWork = (
  actorId: string,
  query: MyWorkQuery
): Effect.Effect<MobileMyWork, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async (): Promise<MobileMyWork> => {
      const today = getUtcToday();
      const assignments = await db.orm.public.TaskAssignee.where({
        userId: actorId,
      })
        .select("taskId")
        .all();
      if (assignments.length === 0) {
        return { items: [], nextOffset: null };
      }
      const tasks = await db.orm.public.Task.where((task) =>
        and(
          task.id.in(assignments.map(({ taskId }) => taskId)),
          task.archivedAt.isNull(),
          task.type.eq("task"),
          task.status.neq("done"),
          ...(query.scope === "assigned"
            ? []
            : [
                task.dueDate.isNotNull(),
                query.scope === "overdue"
                  ? task.dueDate.lt(today)
                  : task.dueDate.lte(today),
              ])
        )
      )
        .orderBy((task) => task.dueDate.asc())
        .orderBy((task) => task.projectTaskNumber.asc())
        .orderBy((task) => task.id.asc())
        .limit(query.limit + 1)
        .offset(query.offset)
        .all();
      const page = tasks.slice(0, query.limit);
      const projects = await db.orm.public.Project.where((project) =>
        project.id.in([...new Set(page.map(({ projectId }) => projectId))])
      )
        .select("id", "key", "name")
        .all();
      const byId = new Map(projects.map((project) => [project.id, project]));
      return {
        items: page.map((task) => ({
          dueDate: task.dueDate,
          id: task.id,
          isOverdue: task.dueDate !== null && task.dueDate < today,
          priority: decodeTaskPriority(task.priority),
          projectId: task.projectId,
          projectName: byId.get(task.projectId)?.name ?? "",
          reference: `${byId.get(task.projectId)?.key ?? ""}-${task.projectTaskNumber}`,
          status: decodeTaskStatus(task.status),
          title: task.title,
          version: task.version,
        })),
        nextOffset:
          tasks.length > query.limit ? query.offset + query.limit : null,
      };
    },
  });
