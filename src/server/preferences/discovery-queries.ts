import { and, or } from "@prisma/orm-postgres/orm-client";
import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import type { AppError } from "../core/action-result";
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
      const [projects, tasks] = await Promise.all([
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
      ]);
      const activeProjects = new Set(projects.map(({ id }) => id));
      const activeTasks = [];
      for (const task of tasks) {
        if (activeProjects.has(task.projectId)) {
          activeTasks.push({
            id: task.id,
            projectId: task.projectId,
            title: task.title,
          });
        }
      }
      return {
        projects,
        recentSearches,
        tasks: activeTasks,
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
