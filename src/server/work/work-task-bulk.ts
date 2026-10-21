import { randomUUID } from "node:crypto";

import type { ResultType } from "@prisma/orm-postgres/components/runtime";
import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { enqueueTaskChange } from "../webhooks/webhook-task-event";
import type {
  BulkTaskChanges,
  BulkTaskTarget,
  CreatedTask,
  TaskArchiveUndoReceipt,
} from "./work-contracts";
import { decodeTaskPriority, decodeTaskStatus } from "./work-contracts";
import type { Transaction } from "./work-internal";
import { databaseError } from "./work-internal";
import { notifyTaskAssignees } from "./work-notifications";
import type {
  BulkActor,
  BulkRecurrence,
  BulkTaskRow,
} from "./work-task-bulk-access";
import {
  assertBulkTasksEditable,
  groupAssigneesByTask,
  loadBulkActor,
  loadBulkTaskRecords,
} from "./work-task-bulk-access";
import { validateBulkTaskInput } from "./work-task-bulk-validation";
import { createRecurrenceSuccessor } from "./work-task-state";

type UpdatedTaskRow = ResultType<typeof db.orm.public.Task>;

const COMPLETION_UNDO_WINDOW_MS = 5 * 60 * 1000;

const staleTasksError = () =>
  new AppError({
    code: "CONFLICT",
    message: "One or more tasks changed. Refresh and try again.",
  });

const missingTasksError = () =>
  new AppError({
    code: "NOT_FOUND",
    message: "One or more tasks were not found.",
  });

const writeBulkTaskChange = async (
  transaction: Transaction,
  task: BulkTaskRow,
  expectedVersion: number | undefined,
  changes: BulkTaskChanges,
  now: Date
): Promise<UpdatedTaskRow> => {
  if (!expectedVersion) {
    throw staleTasksError();
  }
  const updatedCount = await transaction.orm.public.Task.where({
    id: task.id,
    version: expectedVersion,
  }).updateAndCount({
    completedAt: changes.status === "done" ? (task.completedAt ?? now) : null,
    dueDate: changes.dueDate,
    priority: changes.priority,
    status: changes.status,
    updatedAt: now,
    version: expectedVersion + 1,
  });
  if (!updatedCount) {
    throw staleTasksError();
  }
  const updated = await transaction.orm.public.Task.where({
    id: task.id,
  }).first();
  if (!updated) {
    throw missingTasksError();
  }
  return updated;
};

const replaceBulkAssignees = async (
  transaction: Transaction,
  taskIds: readonly string[],
  assigneeIds: readonly string[],
  actorId: string,
  now: Date
): Promise<void> => {
  await transaction.orm.public.TaskAssignee.where((assignment) =>
    assignment.taskId.in(taskIds)
  ).deleteAll();
  await Promise.all(
    taskIds.flatMap((taskId) =>
      assigneeIds.map((userId) =>
        transaction.orm.public.TaskAssignee.create({
          assignedAt: now,
          assignedById: actorId,
          taskId,
          userId,
        })
      )
    )
  );
};

const recordCompletionUndo = async (
  transaction: Transaction,
  task: BulkTaskRow,
  updated: UpdatedTaskRow,
  actorId: string,
  now: Date
): Promise<TaskArchiveUndoReceipt> => {
  const undoId = randomUUID();
  const expiresAt = new Date(now.getTime() + COMPLETION_UNDO_WINDOW_MS);
  await transaction.orm.public.UndoRecord.create({
    action: "task.complete",
    actorId,
    createdAt: now,
    entityId: task.id,
    entityType: "task",
    expiresAt,
    id: undoId,
    snapshot: {
      status: decodeTaskStatus(task.status),
      version: updated.version,
    },
  });
  return { expiresAt: expiresAt.toISOString(), undoId };
};

interface BulkFollowUpContext {
  readonly actor: BulkActor;
  readonly actorId: string;
  readonly assigneeIds: readonly string[];
  readonly changes: BulkTaskChanges;
  readonly now: Date;
  readonly previousAssignees: ReadonlySet<string>;
  readonly recurrence: BulkRecurrence | undefined;
  readonly targetCount: number;
}

// Notifications, activity, recurrence and undo for one task after its row is saved.
const finishBulkTaskUpdate = async (
  transaction: Transaction,
  task: BulkTaskRow,
  updated: UpdatedTaskRow,
  context: BulkFollowUpContext
): Promise<CreatedTask> => {
  const { actorId, assigneeIds, changes, now, previousAssignees } = context;
  const actorSummary = { id: actorId, name: context.actor.name };
  const taskSummary = {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
  };
  await notifyTaskAssignees(
    transaction,
    actorSummary,
    taskSummary,
    assigneeIds.filter((userId) => !previousAssignees.has(userId)),
    now
  );
  await notifyTaskAssignees(
    transaction,
    actorSummary,
    taskSummary,
    [
      task.createdById,
      ...assigneeIds.filter((userId) => previousAssignees.has(userId)),
    ],
    now,
    "update"
  );
  await transaction.orm.public.Activity.create({
    action: "task.bulk_updated",
    actorId,
    createdAt: now,
    details: { count: context.targetCount, status: changes.status },
    id: randomUUID(),
    projectId: task.projectId,
    taskId: task.id,
  });
  const completionTransition =
    task.status !== "done" && changes.status === "done";
  await enqueueTaskChange(transaction, {
    dueDate: updated.dueDate,
    id: task.id,
    now,
    previousStatus: task.status,
    priority: updated.priority,
    projectId: task.projectId,
    projectTaskNumber: task.projectTaskNumber,
    status: updated.status,
    title: task.title,
  });
  const successorId = completionTransition
    ? await createRecurrenceSuccessor(
        transaction,
        context.recurrence ?? null,
        task,
        actorId,
        updated.version,
        changes.dueDate,
        task.description,
        changes.priority,
        task.title,
        assigneeIds,
        now
      )
    : undefined;
  const completionUndo = completionTransition
    ? await recordCompletionUndo(transaction, task, updated, actorId, now)
    : undefined;
  return {
    assigneeIds,
    createdById: task.createdById,
    ...(completionUndo ? { completionUndo } : {}),
    ...(successorId ? { recurrenceSuccessorId: successorId } : {}),
    description: task.description,
    dueDate: updated.dueDate,
    id: task.id,
    priority: decodeTaskPriority(updated.priority),
    projectId: task.projectId,
    projectTaskNumber: task.projectTaskNumber,
    status: decodeTaskStatus(updated.status),
    title: task.title,
    version: updated.version,
  };
};

export const bulkUpdateTasks = (
  actorId: string,
  targets: readonly BulkTaskTarget[],
  changes: BulkTaskChanges
): Effect.Effect<readonly CreatedTask[], AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => {
      const { assigneeIds, targetsById, taskIds } = validateBulkTaskInput(
        targets,
        changes
      );
      return db.transaction(async (transaction) => {
        const [actor, records] = await Promise.all([
          loadBulkActor(transaction, actorId),
          loadBulkTaskRecords(transaction, taskIds, assigneeIds),
        ]);
        const assignmentsByTask = groupAssigneesByTask(records.assignments);
        assertBulkTasksEditable(records, assigneeIds, {
          actor,
          actorId,
          assignmentsByTask,
          changes,
          targetsById,
        });
        const now = new Date();
        const orderedTasks = records.tasks.toSorted((left, right) =>
          left.id.localeCompare(right.id)
        );
        const updatedTasks = await Promise.all(
          orderedTasks.map((task) =>
            writeBulkTaskChange(
              transaction,
              task,
              targetsById.get(task.id)?.expectedVersion,
              changes,
              now
            )
          )
        );
        await replaceBulkAssignees(
          transaction,
          updatedTasks.map((task) => task.id),
          assigneeIds,
          actorId,
          now
        );
        const recurrenceByTaskId = new Map(
          records.recurrences.map(
            (recurrence) => [recurrence.taskId, recurrence] as const
          )
        );
        return Promise.all(
          orderedTasks.map((task, index) => {
            const updated = updatedTasks[index];
            if (!updated) {
              throw missingTasksError();
            }
            return finishBulkTaskUpdate(transaction, task, updated, {
              actor,
              actorId,
              assigneeIds,
              changes,
              now,
              previousAssignees: assignmentsByTask.get(task.id) ?? new Set(),
              recurrence: recurrenceByTaskId.get(task.id),
              targetCount: targets.length,
            });
          })
        );
      });
    },
  });
