import { randomUUID } from "node:crypto";

import { and, or } from "@prisma/orm-postgres/orm-client";
import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";

export interface PersonalWorkspace {
  readonly projects: readonly { readonly id: string; readonly name: string }[];
  readonly tasks: readonly {
    readonly id: string;
    readonly title: string;
    readonly projectId: string;
  }[];
  readonly recentSearches: readonly string[];
}

export interface WorkspaceSearchResults {
  readonly projects: readonly { readonly id: string; readonly name: string }[];
  readonly tasks: readonly {
    readonly id: string;
    readonly title: string;
    readonly projectId: string;
    readonly projectName: string;
  }[];
}

export const PersonalWorkspaceSchema = Schema.Struct({
  projects: Schema.Array(
    Schema.Struct({ id: Schema.String, name: Schema.String })
  ),
  recentSearches: Schema.Array(Schema.String),
  tasks: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      projectId: Schema.String,
      title: Schema.String,
    })
  ),
});

export const WorkspaceSearchResultsSchema = Schema.Struct({
  projects: Schema.Array(
    Schema.Struct({ id: Schema.String, name: Schema.String })
  ),
  tasks: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      projectId: Schema.String,
      projectName: Schema.String,
      title: Schema.String,
    })
  ),
});

export class DiscoveryManagement extends Context.Service<
  DiscoveryManagement,
  {
    readonly toggleProjectFavorite: (
      userId: string,
      projectId: string
    ) => Effect.Effect<boolean, AppError>;
    readonly toggleTaskFavorite: (
      userId: string,
      taskId: string
    ) => Effect.Effect<boolean, AppError>;
    readonly addRecentSearch: (
      userId: string,
      query: string
    ) => Effect.Effect<readonly string[], AppError>;
    readonly listPersonalWorkspace: (
      userId: string
    ) => Effect.Effect<PersonalWorkspace, AppError>;
    readonly searchWorkspace: (
      userId: string,
      query: string
    ) => Effect.Effect<WorkspaceSearchResults, AppError>;
  }
>()("metsys/server/DiscoveryManagement") {}

const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The workspace request could not be completed.",
      });

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const requireUser = async (userId: string): Promise<void> => {
  const user = await db.orm.public.User.where({ id: userId })
    .select("deactivatedAt", "mustChangePassword")
    .first();
  if (!user || user.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (user.mustChangePassword) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Change your password before continuing.",
    });
  }
};

const listRecentSearches = async (
  userId: string
): Promise<readonly string[]> => {
  const searches = await db.orm.public.RecentSearch.where({ userId })
    .orderBy((search) => search.searchedAt.desc())
    .limit(10)
    .select("query")
    .all();
  return searches.map(({ query }) => query);
};

const saveRecentSearch = async (
  transaction: DbTransaction,
  userId: string,
  query: string
): Promise<void> => {
  if (!query) {
    return;
  }
  const existing = await transaction.orm.public.RecentSearch.where({ userId })
    .select("id", "query")
    .all();
  const duplicateIds: string[] = [];
  for (const search of existing) {
    if (search.query.toLowerCase() === query.toLowerCase()) {
      duplicateIds.push(search.id);
    }
  }
  if (duplicateIds.length > 0) {
    await transaction.orm.public.RecentSearch.where((search) =>
      search.id.in(duplicateIds)
    ).deleteAll();
  }
  await transaction.orm.public.RecentSearch.create({
    id: randomUUID(),
    query,
    searchedAt: new Date(),
    userId,
  });
  const ordered = await transaction.orm.public.RecentSearch.where({ userId })
    .orderBy((search) => search.searchedAt.desc())
    .select("id")
    .all();
  const expiredIds = ordered.slice(10).map(({ id }) => id);
  if (expiredIds.length > 0) {
    await transaction.orm.public.RecentSearch.where((search) =>
      search.id.in(expiredIds)
    ).deleteAll();
  }
};

const toggleProjectFavorite = (
  userId: string,
  projectId: string
): Effect.Effect<boolean, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      await requireUser(userId);
      return db.transaction(async (transaction) => {
        const project = await transaction.orm.public.Project.where({
          id: projectId,
        })
          .select("id", "archivedAt")
          .first();
        if (!project || project.archivedAt) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The active project does not exist.",
          });
        }
        const favorite = await transaction.orm.public.FavoriteProject.where({
          projectId,
          userId,
        }).delete();
        if (favorite) {
          return false;
        }
        await transaction.orm.public.FavoriteProject.create({
          createdAt: new Date(),
          projectId,
          userId,
        });
        return true;
      });
    },
  });

const toggleTaskFavorite = (
  userId: string,
  taskId: string
): Effect.Effect<boolean, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      await requireUser(userId);
      return db.transaction(async (transaction) => {
        const task = await transaction.orm.public.Task.include("project")
          .where({ id: taskId })
          .first();
        if (!task || task.archivedAt || task.project.archivedAt) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The active task does not exist.",
          });
        }
        const favorite = await transaction.orm.public.FavoriteTask.where({
          taskId,
          userId,
        }).delete();
        if (favorite) {
          return false;
        }
        await transaction.orm.public.FavoriteTask.create({
          createdAt: new Date(),
          taskId,
          userId,
        });
        return true;
      });
    },
  });

const addRecentSearch = (
  userId: string,
  input: string
): Effect.Effect<readonly string[], AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      const query = input.trim().slice(0, 120);
      await requireUser(userId);
      await db.transaction((transaction) =>
        saveRecentSearch(transaction, userId, query)
      );
      return listRecentSearches(userId);
    },
  });

const listPersonalWorkspace = (
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

const searchWorkspace = (
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

export const DiscoveryManagementLive = Layer.succeed(
  DiscoveryManagement,
  DiscoveryManagement.of({
    addRecentSearch,
    listPersonalWorkspace,
    searchWorkspace,
    toggleProjectFavorite,
    toggleTaskFavorite,
  })
);
