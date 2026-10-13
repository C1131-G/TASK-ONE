import { and, or } from "@prisma/orm-postgres/orm-client";
import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import type { AppError } from "../core/action-result";
import { decodeTaskPriority, decodeTaskStatus } from "../work/work-contracts";
import type {
  PersonalWorkspace,
  WorkspaceSearchResults,
} from "./discovery-contracts";
import { mapError, requireUser } from "./discovery-internal";
import {
  listRecentSearches,
  saveRecentSearch,
} from "./discovery-recent-searches";

export const listPersonalWorkspace = (
  userId: string
): Effect.Effect<PersonalWorkspace, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      await requireUser(userId);
      const [projectFavorites, taskFavorites, recentSearches] =
        await Promise.all([
          db.orm.public.FavoriteProject.where({ userId })
            .orderBy((favorite) => favorite.createdAt.desc())
            .select("projectId")
            .all(),
          db.orm.public.FavoriteTask.where({ userId })
            .orderBy((favorite) => favorite.createdAt.desc())
            .select("taskId")
            .all(),
          listRecentSearches(userId),
        ]);
      const favoriteProjectIds = projectFavorites.map(
        ({ projectId }) => projectId
      );
      const favoriteTaskIds = taskFavorites.map(({ taskId }) => taskId);
      const [projects, tasks, assignments] = await Promise.all([
        favoriteProjectIds.length === 0
          ? []
          : db.orm.public.Project.where((project) =>
              and(
                project.id.in(favoriteProjectIds),
                project.archivedAt.isNull()
              )
            )
              .select("id", "name")
              .all(),
        favoriteTaskIds.length === 0
          ? []
          : db.orm.public.Task.include("project")
              .where((task) =>
                and(task.id.in(favoriteTaskIds), task.archivedAt.isNull())
              )
              .include("project")
              .all(),
        favoriteTaskIds.length === 0
          ? []
          : db.orm.public.TaskAssignee.include("user")
              .where((assignment) => assignment.taskId.in(favoriteTaskIds))
              .all(),
      ]);
      const assigneesByTask = new Map<string, typeof assignments>();
      for (const assignment of assignments) {
        const taskAssignees = assigneesByTask.get(assignment.taskId) ?? [];
        taskAssignees.push(assignment);
        assigneesByTask.set(assignment.taskId, taskAssignees);
      }
      const favoriteTaskOrder = new Map(
        favoriteTaskIds.map((taskId, index) => [taskId, index])
      );
      const activeTasks = [];
      for (const task of tasks) {
        // A starred task shows even when its project is not starred.
        if (!task.project.archivedAt) {
          activeTasks.push({
            assignees: (assigneesByTask.get(task.id) ?? []).map(({ user }) => ({
              id: user.id,
              name: user.name,
            })),
            completedAt: task.completedAt?.toISOString() ?? null,
            createdById: task.createdById,
            dueDate: task.dueDate,
            id: task.id,
            priority: decodeTaskPriority(task.priority),
            projectId: task.projectId,
            projectName: task.project.name,
            projectTaskNumber: task.projectTaskNumber,
            startDate: task.startDate,
            status: decodeTaskStatus(task.status),
            title: task.title,
            version: task.version,
          });
        }
      }
      const orderedTasks = activeTasks.toSorted(
        (left, right) =>
          (favoriteTaskOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (favoriteTaskOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      );
      return {
        projects,
        recentSearches,
        tasks: orderedTasks,
      };
    },
  });

export const searchWorkspace = (
  userId: string,
  input: string
): Effect.Effect<WorkspaceSearchResults, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      const query = input.trim().slice(0, 120);
      await requireUser(userId);
      if (!query) {
        return { projects: [], tasks: [] };
      }
      const pattern = `%${query}%`;
      const [projects, tasks] = await Promise.all([
        db.orm.public.Project.where((project) =>
          and(project.archivedAt.isNull(), project.name.ilike(pattern))
        )
          .orderBy((project) => project.name.asc())
          .limit(20)
          .select("id", "name")
          .all(),
        db.orm.public.Task.include("project")
          .where((task) =>
            and(
              task.archivedAt.isNull(),
              or(task.title.ilike(pattern), task.description.ilike(pattern))
            )
          )
          .orderBy((task) => task.updatedAt.desc())
          .limit(50)
          .include("project")
          .all(),
      ]);
      const activeTasks = tasks.filter(
        (task) => task.project.archivedAt === null
      );
      await db.transaction((transaction) =>
        saveRecentSearch(transaction, userId, query)
      );
      return {
        projects,
        tasks: activeTasks.map((task) => ({
          id: task.id,
          projectId: task.projectId,
          projectName: task.project.name,
          title: task.title,
        })),
      };
    },
  });
