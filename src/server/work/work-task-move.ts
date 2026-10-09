import { randomUUID } from "node:crypto";

import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { CreatedTask } from "./work-contracts";
import { decodeTaskPriority, decodeTaskStatus } from "./work-contracts";
import { databaseError } from "./work-internal";
import { allocateTaskNumber } from "./work-task-creation";

export const moveTask = (
  actorId: string,
  taskId: string,
  destinationProjectId: string,
  expectedVersion: number
): Effect.Effect<CreatedTask, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => {
      if (
        !Schema.is(Schema.String.check(Schema.isUUID()))(taskId) ||
        !Schema.is(Schema.String.check(Schema.isUUID()))(
          destinationProjectId
        ) ||
        !Number.isSafeInteger(expectedVersion) ||
        expectedVersion < 1
      ) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message:
            "A valid task, destination project, and task version are required.",
        });
      }
      return db.transaction(async (transaction) => {
        const actor = await transaction.orm.public.User.where({ id: actorId })
          .select("name", "role", "mustChangePassword", "deactivatedAt")
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
        const task = await transaction.orm.public.Task.where({
          id: taskId,
        }).first();
        if (!task) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The task was not found.",
          });
        }
        if (task.archivedAt) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "Archived tasks are read only.",
          });
        }
        if (task.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        const [assignments, projects, pendingUpload] = await Promise.all([
          transaction.orm.public.TaskAssignee.where({ taskId })
            .select("userId")
            .all(),
          transaction.orm.public.Project.where((project) =>
            project.id.in([task.projectId, destinationProjectId])
          ).all(),
          transaction.orm.public.UploadIntent.where({
            state: "pending",
            taskId,
          })
            .select("id")
            .first(),
        ]);
        if (
          actor.role !== "admin" &&
          task.createdById !== actorId &&
          !assignments.some(({ userId }) => userId === actorId)
        ) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "You cannot edit this task.",
          });
        }
        if (task.projectId === destinationProjectId) {
          throw new AppError({
            code: "VALIDATION_FAILED",
            message: "Choose a different destination project.",
          });
        }
        const destination = projects.find(
          ({ id }) => id === destinationProjectId
        );
        if (projects.length !== 2 || !destination) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The source or destination project was not found.",
          });
        }
        if (projects.some(({ archivedAt }) => archivedAt)) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "Archived projects cannot receive moved tasks.",
          });
        }
        if (pendingUpload) {
          throw new AppError({
            code: "CONFLICT",
            message:
              "Finish or cancel pending uploads before moving this task.",
          });
        }
        const [projectTaskNumber, destinationTasks, files] = await Promise.all([
          allocateTaskNumber(transaction, destinationProjectId),
          transaction.orm.public.Task.where({ projectId: destinationProjectId })
            .select("position")
            .all(),
          transaction.orm.public.FileAsset.where({ taskId }).select("id").all(),
        ]);
        let position = -1;
        for (const destinationTask of destinationTasks) {
          position = Math.max(position, destinationTask.position);
        }
        position += 1;
        const version = expectedVersion + 1;
        const now = new Date();
        const moved = await transaction.orm.public.Task.where({
          id: taskId,
          version: expectedVersion,
        }).updateAndCount({
          position,
          projectId: destinationProjectId,
          projectTaskNumber,
          updatedAt: now,
          version,
        });
        if (!moved) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        await Promise.all(
          files.map(({ id }) =>
            transaction.orm.public.FileAsset.where({ id }).update({
              projectId: destinationProjectId,
            })
          )
        );
        await transaction.orm.public.Activity.create({
          action: "task.moved",
          actorId,
          createdAt: now,
          details: {
            fromProjectId: task.projectId,
            toProjectId: destinationProjectId,
          },
          id: randomUUID(),
          projectId: destinationProjectId,
          taskId,
        });
        return {
          assigneeIds: assignments.map(({ userId }) => userId),
          createdById: task.createdById,
          description: task.description,
          dueDate: task.dueDate,
          id: taskId,
          priority: decodeTaskPriority(task.priority),
          projectId: destinationProjectId,
          projectTaskNumber,
          status: decodeTaskStatus(task.status),
          title: task.title,
          version,
        };
      });
    },
  });
