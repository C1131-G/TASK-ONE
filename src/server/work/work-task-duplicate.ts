import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { CreatedTask } from "./work-contracts";
import { decodeTaskPriority } from "./work-contracts";
import { databaseError } from "./work-internal";
import { allocateTaskNumber } from "./work-task-creation";

export const duplicateTask = (
  actorId: string,
  taskId: string,
  expectedVersion: number
): Effect.Effect<CreatedTask, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => {
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "A valid task version is required.",
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
        const source = await transaction.orm.public.Task.include("project")
          .where({ id: taskId })
          .first();
        if (!source) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The task was not found.",
          });
        }
        if (source.archivedAt || source.project.archivedAt) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "Archived work is read only.",
          });
        }
        if (source.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        const [assignments, labels, subtasks, projectTasks] = await Promise.all(
          [
            transaction.orm.public.TaskAssignee.include("user")
              .where({ taskId })
              .all(),
            transaction.orm.public.TaskLabel.where({ taskId })
              .select("labelId")
              .all(),
            transaction.orm.public.TaskSubtask.where({ taskId }).all(),
            transaction.orm.public.Task.where({ projectId: source.projectId })
              .select("position")
              .all(),
          ]
        );
        const activeAssignments = assignments.filter(
          ({ user }) => !user.deactivatedAt
        );
        if (
          actor.role !== "admin" &&
          source.createdById !== actorId &&
          !activeAssignments.some(({ userId }) => userId === actorId)
        ) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "You cannot edit this task.",
          });
        }
        const projectTaskNumber = await allocateTaskNumber(
          transaction,
          source.projectId
        );
        let position = -1;
        for (const task of projectTasks) {
          position = Math.max(position, task.position);
        }
        position += 1;
        const id = randomUUID();
        const now = new Date();
        const titleSuffix = " (copy)";
        const title = `${source.title.slice(0, 240 - titleSuffix.length)}${titleSuffix}`;
        await transaction.orm.public.Task.create({
          archivedAt: null,
          archivedById: null,
          completedAt: null,
          createdAt: now,
          createdById: actorId,
          description: source.description,
          dueDate: source.dueDate,
          estimate: source.estimate,
          id,
          position,
          priority: decodeTaskPriority(source.priority),
          projectId: source.projectId,
          projectTaskNumber,
          startDate: source.startDate,
          status: "todo" as const,
          title,
          updatedAt: now,
          version: 1,
        });
        await Promise.all([
          ...activeAssignments.map(({ userId }) =>
            transaction.orm.public.TaskAssignee.create({
              assignedAt: now,
              assignedById: actorId,
              taskId: id,
              userId,
            })
          ),
          ...labels.map(({ labelId }) =>
            transaction.orm.public.TaskLabel.create({ labelId, taskId: id })
          ),
          ...subtasks.map((subtask) =>
            transaction.orm.public.TaskSubtask.create({
              assigneeId:
                subtask.assigneeId &&
                !assignments.some(
                  ({ userId, user }) =>
                    userId === subtask.assigneeId && user.deactivatedAt
                )
                  ? subtask.assigneeId
                  : null,
              completedAt: null,
              createdAt: now,
              description: subtask.description,
              dueDate: subtask.dueDate,
              id: randomUUID(),
              isCompleted: false,
              position: subtask.position,
              taskId: id,
              title: subtask.title,
            })
          ),
        ]);
        await transaction.orm.public.Activity.create({
          action: "task.duplicated",
          actorId,
          createdAt: now,
          details: { sourceTaskId: taskId },
          id: randomUUID(),
          projectId: source.projectId,
          taskId: id,
        });
        return {
          assigneeIds: activeAssignments.map(({ userId }) => userId),
          createdById: actorId,
          description: source.description,
          dueDate: source.dueDate,
          id,
          priority: decodeTaskPriority(source.priority),
          projectId: source.projectId,
          projectTaskNumber,
          status: "todo" as const,
          title,
          version: 1,
        };
      });
    },
  });
