import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import type {
  MobileSubtaskAddBody,
  MobileSubtaskChangeBody,
  MobileSubtaskResult,
  MobileSubtaskStatus,
  MobileSubtaskStatusBody,
} from "../../mobile-api/routes-tasks";
import { AppError } from "../core/action-result";
import { createSubtask } from "./subtask-create-subtask";
import { mapError } from "./subtask-internal";
import { updateSubtask } from "./subtask-update-subtask";

// Adds a subtask under the same edit rule as the web (admin, creator or
// assignee) and the same parent version check.
export const addSubtaskFromMobile = (
  actorId: string,
  taskId: string,
  body: MobileSubtaskAddBody
): Effect.Effect<MobileSubtaskResult, AppError> =>
  createSubtask(actorId, taskId, body.expectedVersion, {
    assigneeId: body.assigneeId ?? null,
    description: body.description ?? null,
    dueDate: body.dueDate ?? null,
    title: body.title,
  });

// Fields the body leaves out keep their stored value, so the app can toggle
// `completed` alone. A subtask under a different task reads as missing.
export const changeSubtaskFromMobile = (
  actorId: string,
  taskId: string,
  subtaskId: string,
  body: MobileSubtaskChangeBody
): Effect.Effect<MobileSubtaskResult, AppError> =>
  Effect.gen(function* applySubtaskChange() {
    const current = yield* Effect.tryPromise({
      catch: mapError,
      try: () => db.orm.public.TaskSubtask.where({ id: subtaskId }).first(),
    });
    if (!current || current.taskId !== taskId) {
      return yield* new AppError({
        code: "NOT_FOUND",
        message: "The subtask was not found.",
      });
    }
    return yield* updateSubtask(actorId, subtaskId, body.expectedVersion, {
      assigneeId:
        body.assigneeId === undefined ? current.assigneeId : body.assigneeId,
      completed: body.completed ?? current.isCompleted,
      description:
        body.description === undefined ? current.description : body.description,
      dueDate: body.dueDate === undefined ? current.dueDate : body.dueDate,
      title: body.title ?? current.title,
    });
  });

// The status route only toggles completion, so it answers with the new state
// and the parent version the next write must send.
export const setSubtaskStatusFromMobile = (
  actorId: string,
  taskId: string,
  subtaskId: string,
  body: MobileSubtaskStatusBody
): Effect.Effect<MobileSubtaskStatus, AppError> =>
  Effect.map(
    changeSubtaskFromMobile(actorId, taskId, subtaskId, {
      completed: body.done,
      expectedVersion: body.expectedVersion,
    }),
    (result) => ({
      done: result.subtask.completed,
      version: result.parentVersion,
    })
  );
