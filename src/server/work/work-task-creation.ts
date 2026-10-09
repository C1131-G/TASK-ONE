import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { CreatedTask, CreateTaskInput } from "./work-contracts";
import { databaseError, validateInput } from "./work-internal";
import type { Transaction } from "./work-internal";
import { notifyTaskAssignees } from "./work-notifications";

export const allocateTaskNumber = async (
  transaction: Transaction,
  projectId: string
): Promise<number> => {
  const now = new Date();
  const counter = await transaction.orm.public.ProjectTaskCounter.upsert({
    conflictOn: { projectId },
    create: { nextNumber: 1, projectId, updatedAt: now },
    update: { updatedAt: now },
  });
  const allocated = await transaction.orm.public.ProjectTaskCounter.where({
    nextNumber: counter.nextNumber,
    projectId,
  }).updateAndCount({
    nextNumber: counter.nextNumber + 1,
    updatedAt: new Date(),
  });
  if (!allocated) {
    throw new AppError({
      code: "CONFLICT",
      message: "Task numbering changed. Retry the request.",
    });
  }
  return counter.nextNumber;
};

export const createTaskInTransaction = async (
  transaction: Transaction,
  actorId: string,
  input: CreateTaskInput
): Promise<CreatedTask> => {
  const actor = await transaction.orm.public.User.where({ id: actorId })
    .select("deactivatedAt", "mustChangePassword", "name")
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
  const project = await transaction.orm.public.Project.where({
    archivedAt: null,
    id: input.projectId,
  })
    .select("id")
    .first();
  if (!project) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The active project was not found.",
    });
  }
  const assignees = await transaction.orm.public.User.where((user) =>
    user.id.in(input.assigneeIds)
  )
    .select("id", "deactivatedAt")
    .all();
  if (
    assignees.length !== input.assigneeIds.length ||
    assignees.some(({ deactivatedAt }) => deactivatedAt)
  ) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Choose active employee accounts for every assignee.",
    });
  }
  const projectTaskNumber = await allocateTaskNumber(
    transaction,
    input.projectId
  );
  const taskId = randomUUID();
  const now = new Date();
  await transaction.orm.public.Task.create({
    archivedAt: null,
    archivedById: null,
    completedAt: null,
    createdAt: now,
    createdById: actorId,
    description: input.description,
    dueDate: input.dueDate,
    estimate: input.estimate ?? null,
    id: taskId,
    position: 0,
    priority: input.priority,
    projectId: input.projectId,
    projectTaskNumber,
    startDate: input.startDate ?? null,
    status: "todo",
    title: input.title,
    updatedAt: now,
    version: 1,
  });
  await Promise.all(
    input.assigneeIds.map((userId) =>
      transaction.orm.public.TaskAssignee.create({
        assignedAt: now,
        assignedById: actorId,
        taskId,
        userId,
      })
    )
  );
  await notifyTaskAssignees(
    transaction,
    { id: actorId, name: actor.name },
    { id: taskId, projectId: input.projectId, title: input.title },
    input.assigneeIds,
    now
  );
  await transaction.orm.public.Activity.create({
    action: "task.created",
    actorId,
    createdAt: now,
    details: { projectId: input.projectId, projectTaskNumber, taskId },
    id: randomUUID(),
    projectId: input.projectId,
    taskId,
  });
  return {
    assigneeIds: input.assigneeIds,
    createdById: actorId,
    description: input.description,
    dueDate: input.dueDate,
    id: taskId,
    priority: input.priority,
    projectId: input.projectId,
    projectTaskNumber,
    status: "todo",
    title: input.title,
    version: 1,
  };
};

export const createTask = (
  actorId: string,
  rawInput: CreateTaskInput
): Effect.Effect<CreatedTask, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => {
      const input = validateInput(rawInput);
      return db.transaction((transaction) =>
        createTaskInTransaction(transaction, actorId, input)
      );
    },
  });
