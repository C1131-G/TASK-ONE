import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";

export interface TaskRelationInput {
  readonly labelIds: readonly string[];
  readonly dependencyTaskIds: readonly string[];
}

export interface TaskRelationResult extends TaskRelationInput {
  readonly taskId: string;
  readonly version: number;
}

export const TaskRelationResultSchema = Schema.Struct({
  dependencyTaskIds: Schema.Array(Schema.String),
  labelIds: Schema.Array(Schema.String),
  taskId: Schema.String,
  version: Schema.Number,
});

export class TaskRelations extends Context.Service<
  TaskRelations,
  {
    readonly setTaskRelations: (
      actorId: string,
      taskId: string,
      expectedVersion: number,
      input: TaskRelationInput
    ) => Effect.Effect<TaskRelationResult, AppError>;
  }
>()("metsys/server/TaskRelations") {}

const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The task relations could not be updated.",
      });

const taskIdSchema = Schema.String.check(Schema.isUUID());

const introducesCycle = (
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  taskId: string,
  dependencyTaskIds: readonly string[]
): Promise<boolean> => {
  const visited = new Set<string>();
  const visit = async (frontier: readonly string[]): Promise<boolean> => {
    if (frontier.includes(taskId)) {
      return true;
    }
    const freshFrontier = frontier.filter((nodeId) => !visited.has(nodeId));
    if (freshFrontier.length === 0) {
      return false;
    }
    const nextFrontier: string[] = [];
    const edges = await transaction.orm.public.TaskDependency.where((edge) =>
      edge.taskId.in([...freshFrontier])
    )
      .select("dependsOnTaskId")
      .all();
    for (const visitedId of freshFrontier) {
      visited.add(visitedId);
    }
    for (const edge of edges) {
      if (!visited.has(edge.dependsOnTaskId)) {
        nextFrontier.push(edge.dependsOnTaskId);
      }
    }
    return visit(nextFrontier);
  };
  return visit(dependencyTaskIds);
};

const setTaskRelations = (
  actorId: string,
  taskId: string,
  expectedVersion: number,
  input: TaskRelationInput
): Effect.Effect<TaskRelationResult, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => {
      const labelIds = [...input.labelIds];
      const dependencyTaskIds = [...input.dependencyTaskIds];
      if (
        !Schema.is(taskIdSchema)(taskId) ||
        !Number.isSafeInteger(expectedVersion) ||
        expectedVersion < 1 ||
        labelIds.length > 100 ||
        dependencyTaskIds.length > 100 ||
        new Set(labelIds).size !== labelIds.length ||
        new Set(dependencyTaskIds).size !== dependencyTaskIds.length ||
        labelIds.some((id) => !Schema.is(taskIdSchema)(id)) ||
        dependencyTaskIds.some((id) => !Schema.is(taskIdSchema)(id))
      ) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Check the task version and relation lists.",
        });
      }
      if (dependencyTaskIds.includes(taskId)) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "A task cannot depend on itself.",
        });
      }

      return db.transaction(async (transaction) => {
        const actor = await transaction.orm.public.User.where({ id: actorId })
          .select("role", "mustChangePassword", "deactivatedAt")
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
        const task = await transaction.orm.public.Task.include("project")
          .where({ id: taskId })
          .first();
        if (!task) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The task was not found.",
          });
        }
        if (task.archivedAt || task.project.archivedAt) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "Archived work is read only.",
          });
        }
        if (task.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        await transaction.orm.public.CompanySettings.upsert({
          conflictOn: { id: "company" },
          create: {
            brandColor: "#1D1C1A",
            brandEnabled: true,
            id: "company",
            name: "Gr8r Studio",
            settings: {},
            slug: "gr8rstudio",
            timeZone: "Asia/Kolkata",
            updatedAt: new Date(),
          },
          update: { updatedAt: new Date() },
        });
        if (actor.role !== "admin" && task.createdById !== actorId) {
          const assignment = await transaction.orm.public.TaskAssignee.where({
            taskId,
            userId: actorId,
          })
            .select("taskId")
            .first();
          if (!assignment) {
            throw new AppError({
              code: "FORBIDDEN",
              message: "You cannot edit this task.",
            });
          }
        }
        if (labelIds.length > 0) {
          const labels = await transaction.orm.public.Label.where((label) =>
            label.id.in(labelIds)
          )
            .select("id")
            .all();
          if (labels.length !== labelIds.length) {
            throw new AppError({
              code: "VALIDATION_FAILED",
              message: "Choose existing company labels.",
            });
          }
        }
        if (dependencyTaskIds.length > 0) {
          const dependencies = await transaction.orm.public.Task.include(
            "project"
          )
            .where((candidate) =>
              and(
                candidate.id.in(dependencyTaskIds),
                candidate.archivedAt.isNull()
              )
            )
            .all();
          if (
            dependencies.length !== dependencyTaskIds.length ||
            dependencies.some((dependency) => dependency.project.archivedAt)
          ) {
            throw new AppError({
              code: "VALIDATION_FAILED",
              message: "Choose active tasks for every dependency.",
            });
          }
          if (await introducesCycle(transaction, taskId, dependencyTaskIds)) {
            throw new AppError({
              code: "CONFLICT",
              message: "Those dependencies would create a task cycle.",
            });
          }
        }

        await transaction.orm.public.TaskLabel.where({ taskId }).deleteAll();
        await transaction.orm.public.TaskDependency.where({
          taskId,
        }).deleteAll();
        await Promise.all([
          ...labelIds.map((labelId) =>
            transaction.orm.public.TaskLabel.create({ labelId, taskId })
          ),
          ...dependencyTaskIds.map((dependsOnTaskId) =>
            transaction.orm.public.TaskDependency.create({
              createdAt: new Date(),
              dependsOnTaskId,
              taskId,
            })
          ),
        ]);
        const version = expectedVersion + 1;
        const updated = await transaction.orm.public.Task.where({
          id: taskId,
          version: expectedVersion,
        }).updateAndCount({ updatedAt: new Date(), version });
        if (!updated) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        await transaction.orm.public.Activity.create({
          action: "task.relations_updated",
          actorId,
          createdAt: new Date(),
          details: { dependencyTaskIds, labelIds },
          id: randomUUID(),
          projectId: task.projectId,
          taskId,
        });
        return {
          dependencyTaskIds: [...dependencyTaskIds].toSorted(),
          labelIds: [...labelIds].toSorted(),
          taskId,
          version,
        };
      });
    },
  });

export const TaskRelationsLive = Layer.succeed(
  TaskRelations,
  TaskRelations.of({ setTaskRelations })
);
