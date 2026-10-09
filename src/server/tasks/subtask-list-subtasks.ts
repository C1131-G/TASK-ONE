import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { SubtaskEntry } from "./subtask-contracts";
import { mapError, toEntry } from "./subtask-internal";

export const listSubtasks = (
  actorId: string,
  taskId: string
): Effect.Effect<readonly SubtaskEntry[], AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      const actor = await db.orm.public.User.where({ id: actorId })
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
      const task = await db.orm.public.Task.where({ id: taskId })
        .select("id")
        .first();
      if (!task) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "The task was not found.",
        });
      }
      const rows = await db.orm.public.TaskSubtask.where({ taskId })
        .orderBy((subtask) => subtask.position.asc())
        .all();
      return rows.map(toEntry);
    },
  });
