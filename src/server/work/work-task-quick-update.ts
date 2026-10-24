import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import type { MobileTaskChange } from "../../mobile-api/routes-tasks";
import { AppError } from "../core/action-result";
import { decodeTaskPriority, decodeTaskStatus } from "./work-contracts";
import { databaseError } from "./work-internal";
import { updateTask } from "./work-task-update";

export interface QuickTaskChange {
  readonly assigneeIds?: readonly string[] | undefined;
  readonly dueDate?: string | null | undefined;
  readonly priority?: MobileTaskChange["priority"] | undefined;
  readonly status?: MobileTaskChange["status"] | undefined;
}

const hasChange = (change: QuickTaskChange): boolean =>
  change.assigneeIds !== undefined ||
  change.dueDate !== undefined ||
  change.priority !== undefined ||
  change.status !== undefined;

// A quick change touches only the fields it names. Everything else keeps its
// current value, and the full update runs through the same rules as the web
// editor: edit permission, archived tasks, the version check and the audit
// trail.
export const quickUpdateTask = (
  actorId: string,
  taskId: string,
  expectedVersion: number,
  change: QuickTaskChange
): Effect.Effect<MobileTaskChange, AppError> =>
  Effect.gen(function* applyQuickChange() {
    if (!hasChange(change)) {
      return yield* new AppError({
        code: "VALIDATION_FAILED",
        field: "status",
        message: "Name at least one field to change.",
      });
    }
    const [task, assignments] = yield* Effect.tryPromise({
      catch: databaseError,
      try: () =>
        Promise.all([
          db.orm.public.Task.include("project").where({ id: taskId }).first(),
          db.orm.public.TaskAssignee.where({ taskId }).select("userId").all(),
        ]),
    });
    if (!task) {
      return yield* new AppError({
        code: "NOT_FOUND",
        message: "The task was not found.",
      });
    }
    const updated = yield* updateTask(actorId, taskId, expectedVersion, {
      assigneeIds:
        change.assigneeIds ?? assignments.map(({ userId }) => userId),
      description: task.description,
      dueDate: change.dueDate === undefined ? task.dueDate : change.dueDate,
      priority: change.priority ?? decodeTaskPriority(task.priority),
      status: change.status ?? decodeTaskStatus(task.status),
      title: task.title,
    });
    return {
      assigneeIds: [...updated.assigneeIds],
      dueDate: updated.dueDate,
      id: updated.id,
      priority: updated.priority,
      projectId: updated.projectId,
      reference: `${task.project.key}-${updated.projectTaskNumber}`,
      status: updated.status,
      title: updated.title,
      version: updated.version,
    };
  });
