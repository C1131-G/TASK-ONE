import { and } from "@prisma/orm-postgres/orm-client";

import { AppError } from "../core/action-result";
import type { BulkTaskChanges, BulkTaskTarget } from "./work-contracts";
import type { Transaction } from "./work-internal";
import { assertOrdinaryTask } from "./work-internal";

export const loadBulkActor = async (
  transaction: Transaction,
  actorId: string
) => {
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
  return actor;
};

export type BulkActor = Awaited<ReturnType<typeof loadBulkActor>>;

export const loadBulkTaskRecords = async (
  transaction: Transaction,
  taskIds: readonly string[],
  assigneeIds: readonly string[]
) => {
  const [tasks, assignments, activeUsers, recurrences] = await Promise.all([
    transaction.orm.public.Task.include("project")
      .where((task) => task.id.in(taskIds))
      .all(),
    transaction.orm.public.TaskAssignee.where((assignment) =>
      assignment.taskId.in(taskIds)
    )
      .select("taskId", "userId")
      .all(),
    // Client accounts are never task assignees, so they read as missing.
    transaction.orm.public.User.where((user) =>
      and(user.id.in(assigneeIds), user.role.neq("client"))
    )
      .select("id", "deactivatedAt")
      .all(),
    transaction.orm.public.TaskRecurrence.where((recurrence) =>
      recurrence.taskId.in(taskIds)
    ).all(),
  ]);
  return { activeUsers, assignments, recurrences, tasks };
};

type BulkTaskRecords = Awaited<ReturnType<typeof loadBulkTaskRecords>>;
export type BulkTaskRow = BulkTaskRecords["tasks"][number];
export type BulkRecurrence = BulkTaskRecords["recurrences"][number];

export const groupAssigneesByTask = (
  assignments: BulkTaskRecords["assignments"]
): Map<string, Set<string>> => {
  const assignmentsByTask = new Map<string, Set<string>>();
  for (const assignment of assignments) {
    const taskAssignments =
      assignmentsByTask.get(assignment.taskId) ?? new Set<string>();
    taskAssignments.add(assignment.userId);
    assignmentsByTask.set(assignment.taskId, taskAssignments);
  }
  return assignmentsByTask;
};

interface BulkEditContext {
  readonly actor: BulkActor;
  readonly actorId: string;
  readonly assignmentsByTask: ReadonlyMap<string, ReadonlySet<string>>;
  readonly changes: BulkTaskChanges;
  readonly targetsById: ReadonlyMap<string, BulkTaskTarget>;
}

const assertBulkTaskEditable = (
  task: BulkTaskRow,
  recurringTaskIds: ReadonlySet<string>,
  context: BulkEditContext
): void => {
  assertOrdinaryTask(task);
  if (task.archivedAt || task.project.archivedAt) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Archived work is read only.",
    });
  }
  if (task.version !== context.targetsById.get(task.id)?.expectedVersion) {
    throw new AppError({
      code: "CONFLICT",
      message: "One or more tasks changed. Refresh and try again.",
    });
  }
  if (recurringTaskIds.has(task.id) && context.changes.dueDate === null) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Remove recurrence before clearing the task due date.",
    });
  }
  if (
    context.actor.role !== "admin" &&
    task.createdById !== context.actorId &&
    !context.assignmentsByTask.get(task.id)?.has(context.actorId)
  ) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You cannot edit every selected task.",
    });
  }
};

export const assertBulkTasksEditable = (
  records: BulkTaskRecords,
  assigneeIds: readonly string[],
  context: BulkEditContext
): void => {
  if (records.tasks.length !== context.targetsById.size) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "One or more tasks were not found.",
    });
  }
  if (
    records.activeUsers.length !== assigneeIds.length ||
    records.activeUsers.some(({ deactivatedAt }) => deactivatedAt)
  ) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Choose active employees for every assignee.",
    });
  }
  const recurringTaskIds = new Set(
    records.recurrences.map((recurrence) => recurrence.taskId)
  );
  for (const task of records.tasks) {
    assertBulkTaskEditable(task, recurringTaskIds, context);
  }
};
