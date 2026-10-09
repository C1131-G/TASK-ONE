import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { mapError, requireUser } from "./discovery-internal";

export const toggleProjectFavorite = (
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

export const toggleTaskFavorite = (
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
