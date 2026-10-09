import { randomUUID } from "node:crypto";

import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { TaskRecurrenceInput } from "./work-contracts";
import { TaskRecurrenceInputSchema } from "./work-contracts";
import { databaseError } from "./work-internal";

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const formatDate = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

export const nextRecurrenceDate = (
  dueDate: string,
  recurrence: TaskRecurrenceInput
): string => {
  const [yearText, monthText, dayText] = dueDate.split("-");
  const current = new Date(
    Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText))
  );
  if (recurrence.frequency === "daily") {
    return formatDate(addDays(current, recurrence.interval));
  }
  if (
    recurrence.frequency === "weekly" ||
    recurrence.frequency === "biweekly"
  ) {
    const weeks =
      recurrence.interval * (recurrence.frequency === "biweekly" ? 2 : 1);
    let next = addDays(current, weeks * 7);
    if (recurrence.weekDays.length > 0) {
      const selectedWeekDays = new Set(recurrence.weekDays);
      for (let offset = 0; offset < 7; offset += 1) {
        const candidate = addDays(next, offset);
        if (selectedWeekDays.has(candidate.getUTCDay())) {
          next = candidate;
          break;
        }
      }
    }
    return formatDate(next);
  }
  const targetMonth = new Date(
    Date.UTC(
      current.getUTCFullYear(),
      current.getUTCMonth() + recurrence.interval,
      1
    )
  );
  const lastDay = new Date(
    Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)
  ).getUTCDate();
  targetMonth.setUTCDate(Math.min(current.getUTCDate(), lastDay));
  return formatDate(targetMonth);
};

export const setTaskRecurrence = (
  actorId: string,
  taskId: string,
  expectedVersion: number,
  rawInput: TaskRecurrenceInput | null
): Effect.Effect<{ readonly version: number }, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => {
      let input: TaskRecurrenceInput | null;
      try {
        input = Schema.decodeUnknownSync(
          Schema.NullOr(TaskRecurrenceInputSchema)
        )(rawInput);
      } catch {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Enter valid task recurrence settings.",
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
        if (input && task.status === "done") {
          throw new AppError({
            code: "VALIDATION_FAILED",
            message: "Recurrence can only be configured on an active task.",
          });
        }
        if (input && !task.dueDate) {
          throw new AppError({
            code: "VALIDATION_FAILED",
            message: "A due date is required before recurrence can be enabled.",
          });
        }
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
        const version = expectedVersion + 1;
        const now = new Date();
        const updated = await transaction.orm.public.Task.where({
          id: taskId,
          version: expectedVersion,
        }).updateAndCount({ updatedAt: now, version });
        if (!updated) {
          throw new AppError({
            code: "CONFLICT",
            message: "The task changed. Refresh and try again.",
          });
        }
        if (!input) {
          await transaction.orm.public.TaskRecurrence.where({
            taskId,
          }).delete();
        }
        if (input) {
          const recurrence = await transaction.orm.public.TaskRecurrence.where({
            taskId,
          }).first();
          const values = {
            endsOn: input.endsOn,
            frequency: input.frequency,
            interval: input.interval,
            nextRunAt: task.dueDate,
            updatedAt: now,
            weekDays: input.weekDays,
          };
          await (recurrence
            ? transaction.orm.public.TaskRecurrence.where({ taskId }).update(
                values
              )
            : transaction.orm.public.TaskRecurrence.create({
                id: randomUUID(),
                taskId,
                ...values,
              }));
        }
        await transaction.orm.public.Activity.create({
          action: input ? "task.recurrence_updated" : "task.recurrence_removed",
          actorId,
          createdAt: now,
          details: { taskId, version },
          id: randomUUID(),
          projectId: task.projectId,
          taskId,
        });
        return { version };
      });
    },
  });
