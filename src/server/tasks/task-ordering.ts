import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";

export interface TaskPositionChange {
  readonly taskId: string;
  readonly expectedVersion: number;
  readonly position: number;
}

export interface OrderedTask {
  readonly taskId: string;
  readonly position: number;
  readonly version: number;
}

export const OrderedTaskSchema = Schema.Struct({
  position: Schema.Number,
  taskId: Schema.String,
  version: Schema.Number,
});

export class TaskOrdering extends Context.Service<
  TaskOrdering,
  {
    readonly reorderTasks: (
      actorId: string,
      changes: readonly TaskPositionChange[]
    ) => Effect.Effect<readonly OrderedTask[], AppError>;
  }
>()("metsys/server/TaskOrdering") {}

const databaseError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  return new AppError({
    code: "UNAVAILABLE",
    message: "Task order could not be saved.",
  });
};

const taskIdSchema = Schema.String.check(Schema.isUUID());

const reorderTasks = (
  actorId: string,
  changes: readonly TaskPositionChange[]
): Effect.Effect<readonly OrderedTask[], AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => {
      const taskIds = changes.map(({ taskId }) => taskId);
      if (
        changes.length === 0 ||
        changes.length > 100 ||
        new Set(taskIds).size !== changes.length ||
        changes.some(
          ({ taskId, expectedVersion, position }) =>
            !Schema.is(taskIdSchema)(taskId) ||
            !Number.isSafeInteger(expectedVersion) ||
            expectedVersion < 1 ||
            !Number.isFinite(position) ||
            Math.abs(position) > 1_000_000_000
        )
      ) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message:
            "Reorder 1 to 100 unique tasks with valid positions and versions.",
        });
      }

      return db.transaction(async (transaction) => {
        const actor = await transaction.orm.public.User.where({ id: actorId })
          .select("role", "deactivatedAt", "mustChangePassword")
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

        const [tasks, assignments] = await Promise.all([
          transaction.orm.public.Task.include("project")
            .where((task) => task.id.in(taskIds))
            .all(),
          transaction.orm.public.TaskAssignee.where((assignment) =>
            assignment.taskId.in(taskIds)
          )
            .select("taskId", "userId")
            .all(),
        ]);
        if (tasks.length !== changes.length) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "One or more tasks were not found.",
          });
        }
        const versions = new Map(
          changes.map(({ expectedVersion, taskId }) => [
            taskId,
            expectedVersion,
          ])
        );
        const assignmentPairs = new Set(
          assignments.map(({ taskId, userId }) => `${taskId}:${userId}`)
        );
        for (const task of tasks) {
          if (task.archivedAt || task.project.archivedAt) {
            throw new AppError({
              code: "FORBIDDEN",
              message: "Archived work is read only.",
            });
          }
          if (versions.get(task.id) !== task.version) {
            throw new AppError({
              code: "CONFLICT",
              message: "One or more tasks changed. Refresh and try again.",
            });
          }
          if (
            actor.role !== "admin" &&
            task.createdById !== actorId &&
            !assignmentPairs.has(`${task.id}:${actorId}`)
          ) {
            throw new AppError({
              code: "FORBIDDEN",
              message: "You cannot reorder every selected task.",
            });
          }
        }

        const ordered = await Promise.all(
          changes.map(async (change) => {
            const updatedCount = await transaction.orm.public.Task.where({
              id: change.taskId,
              version: change.expectedVersion,
            }).updateAndCount({
              position: change.position,
              updatedAt: new Date(),
              version: change.expectedVersion + 1,
            });
            if (!updatedCount) {
              throw new AppError({
                code: "CONFLICT",
                message: "One or more tasks changed. Refresh and try again.",
              });
            }
            const updated = await transaction.orm.public.Task.where({
              id: change.taskId,
            }).first();
            if (!updated) {
              throw new AppError({
                code: "NOT_FOUND",
                message: "One or more tasks were not found.",
              });
            }
            await transaction.orm.public.Activity.create({
              action: "task.reordered",
              actorId,
              createdAt: new Date(),
              details: { position: updated.position },
              id: crypto.randomUUID(),
              projectId: updated.projectId,
              taskId: updated.id,
            });
            return {
              position: updated.position,
              taskId: updated.id,
              version: updated.version,
            };
          })
        );
        return ordered.toSorted(
          (left, right) => left.position - right.position
        );
      });
    },
  });

export const TaskOrderingLive = Layer.succeed(
  TaskOrdering,
  TaskOrdering.of({ reorderTasks })
);
