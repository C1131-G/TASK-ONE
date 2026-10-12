import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { assertStartNotAfterDue, databaseError } from "./work-internal";
import {
  assertTaskEditPermission,
  assertWorkspaceActor,
} from "./work-task-state";

export interface RescheduleTaskInput {
  readonly dueDate: string | null;
  readonly startDate: string | null;
}

// Moves only the two dates. Title, assignees, status and the rest stay as they
// are, so a drag on the calendar or timeline cannot overwrite other fields.
export const rescheduleTask = (
  actorId: string,
  taskId: string,
  expectedVersion: number,
  input: RescheduleTaskInput
): Effect.Effect<{ readonly version: number }, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () =>
      db.transaction(async (transaction) => {
        const actor = await transaction.orm.public.User.where({ id: actorId })
          .select("name", "role", "mustChangePassword", "deactivatedAt")
          .first();
        assertWorkspaceActor(actor);
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
            message: "Archived tasks are read only.",
          });
        }
        if (task.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        const [assignments, recurrence] = await Promise.all([
          transaction.orm.public.TaskAssignee.where({ taskId })
            .select("userId")
            .all(),
          transaction.orm.public.TaskRecurrence.where({ taskId }).first(),
        ]);
        assertTaskEditPermission(actor, actorId, task.createdById, assignments);
        assertStartNotAfterDue(input.startDate, input.dueDate);
        if (recurrence && !input.dueDate) {
          throw new AppError({
            code: "VALIDATION_FAILED",
            message: "Remove recurrence before clearing the task due date.",
          });
        }
        if (
          input.startDate === task.startDate &&
          input.dueDate === task.dueDate
        ) {
          return { version: task.version };
        }
        const now = new Date();
        const version = expectedVersion + 1;
        const updated = await transaction.orm.public.Task.where({
          id: taskId,
          version: expectedVersion,
        }).updateAndCount({
          dueDate: input.dueDate,
          startDate: input.startDate,
          updatedAt: now,
          version,
        });
        if (!updated) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        if (recurrence && input.dueDate !== task.dueDate) {
          await transaction.orm.public.TaskRecurrence.where({ taskId }).update({
            nextRunAt: input.dueDate,
            updatedAt: now,
          });
        }
        await transaction.orm.public.Activity.create({
          action: "task.rescheduled",
          actorId,
          createdAt: now,
          details: {
            from: { dueDate: task.dueDate, startDate: task.startDate },
            taskId,
            to: { dueDate: input.dueDate, startDate: input.startDate },
            version,
          },
          id: randomUUID(),
          projectId: task.projectId,
          taskId,
        });
        return { version };
      }),
  });
