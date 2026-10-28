import { and, or } from "@prisma/orm-postgres/orm-client";
import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { PAGE_DEFAULT_SIZE } from "../../mobile-api/routes-paging";
import type {
  MobileTaskList,
  TaskStatusSchema,
} from "../../mobile-api/routes-tasks";
import type { AppError } from "../core/action-result";
import {
  decodeInboxCursor,
  encodeInboxCursor,
} from "../notifications/inbox-cursor";
import { decodeTaskPriority, decodeTaskStatus } from "./work-contracts";
import { databaseError } from "./work-internal";

export interface TaskListQuery {
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
  readonly mine?: boolean | undefined;
  readonly projectId?: string | undefined;
  readonly status?: typeof TaskStatusSchema.Type | undefined;
}

// Ordinary, unarchived tasks across every project, newest first. The id breaks
// ties, so a page never repeats or skips a task even when many share one
// creation time.
export const listTaskPage = (
  actorId: string,
  query: TaskListQuery
): Effect.Effect<MobileTaskList, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async (): Promise<MobileTaskList> => {
      const limit = query.limit ?? PAGE_DEFAULT_SIZE;
      const after = query.cursor ? decodeInboxCursor(query.cursor) : null;
      const ownAssignments = query.mine
        ? await db.orm.public.TaskAssignee.where({ userId: actorId })
            .select("taskId")
            .all()
        : null;
      const mineIds = ownAssignments?.map(({ taskId }) => taskId) ?? null;
      if (mineIds?.length === 0) {
        return { items: [], nextCursor: null };
      }
      const rows = await db.orm.public.Task.where((task) =>
        and(
          task.archivedAt.isNull(),
          task.type.eq("task"),
          ...(query.projectId ? [task.projectId.eq(query.projectId)] : []),
          ...(query.status ? [task.status.eq(query.status)] : []),
          ...(mineIds ? [task.id.in(mineIds)] : []),
          ...(after
            ? [
                or(
                  task.createdAt.lt(after.createdAt),
                  and(task.createdAt.eq(after.createdAt), task.id.lt(after.id))
                ),
              ]
            : [])
        )
      )
        .orderBy((task) => task.createdAt.desc())
        .orderBy((task) => task.id.desc())
        .limit(limit + 1)
        .all();
      const page = rows.slice(0, limit);
      const last = page.at(-1);
      const taskIds = page.map(({ id }) => id);
      const projectIds = [...new Set(page.map(({ projectId }) => projectId))];
      const [projects, assignments] = await Promise.all([
        db.orm.public.Project.where((project) => project.id.in(projectIds))
          .select("id", "key", "name")
          .all(),
        db.orm.public.TaskAssignee.include("user")
          .where((assignment) => assignment.taskId.in(taskIds))
          .all(),
      ]);
      const projectById = new Map(
        projects.map((project) => [project.id, project])
      );
      return {
        items: page.map((task) => {
          const project = projectById.get(task.projectId);
          const assigned = assignments.filter(
            ({ taskId }) => taskId === task.id
          );
          return {
            assigneeIds: assigned.map(({ userId }) => userId),
            assigneeNames: assigned.map(({ user }) => user.name),
            dueDate: task.dueDate,
            id: task.id,
            priority: decodeTaskPriority(task.priority),
            projectId: task.projectId,
            projectName: project?.name ?? "",
            reference: `${project?.key ?? ""}-${task.projectTaskNumber}`,
            status: decodeTaskStatus(task.status),
            title: task.title,
            version: task.version,
          };
        }),
        nextCursor:
          rows.length > limit && last
            ? encodeInboxCursor({ createdAt: last.createdAt, id: last.id })
            : null,
      };
    },
  });
