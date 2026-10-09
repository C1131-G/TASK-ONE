import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type {
  CreatedTask,
  ProjectTaskListItem,
  UpdateTaskInput,
} from "./work-contracts";
import {
  TaskRecurrenceInputSchema,
  decodeTaskPriority,
  decodeTaskStatus,
} from "./work-contracts";
import { databaseError } from "./work-internal";
import { updateTask } from "./work-task-update";

export const changeTaskStatus = (
  actorId: string,
  taskId: string,
  expectedVersion: number,
  status: UpdateTaskInput["status"]
): Effect.Effect<CreatedTask, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      const task = await db.orm.public.Task.where({ id: taskId })
        .select("description", "dueDate", "priority", "title")
        .first();
      if (!task) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "The task was not found.",
        });
      }
      const assignments = await db.orm.public.TaskAssignee.where({ taskId })
        .select("userId")
        .all();
      return updateTask(actorId, taskId, expectedVersion, {
        assigneeIds: assignments.map(({ userId }) => userId),
        description: task.description,
        dueDate: task.dueDate,
        priority: decodeTaskPriority(task.priority),
        status,
        title: task.title,
      });
    },
  }).pipe(Effect.flatten);

const validateProjectTaskPagination = (
  projectId: string,
  pagination: {
    readonly limit: number;
    readonly offset: number;
  }
): void => {
  if (
    !Schema.is(Schema.String.check(Schema.isUUID()))(projectId) ||
    !Number.isInteger(pagination.limit) ||
    pagination.limit < 1 ||
    pagination.limit > 200 ||
    !Number.isInteger(pagination.offset) ||
    pagination.offset < 0
  ) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "The project task query is invalid.",
    });
  }
};

export const listProjectTasks = (
  actorId: string,
  projectId: string,
  pagination: {
    readonly includeArchived?: boolean;
    readonly limit: number;
    readonly offset: number;
  }
): Effect.Effect<readonly ProjectTaskListItem[], AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      const actor = await db.orm.public.User.where({ id: actorId })
        .select("deactivatedAt", "mustChangePassword")
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
      validateProjectTaskPagination(projectId, pagination);
      const project = await db.orm.public.Project.where({ id: projectId })
        .select("id")
        .first();
      if (!project) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "The project was not found.",
        });
      }
      const tasks = await db.orm.public.Task.where(
        pagination.includeArchived
          ? { projectId }
          : { archivedAt: null, projectId }
      )
        .orderBy((task) => task.position.asc())
        .orderBy((task) => task.projectTaskNumber.asc())
        .limit(pagination.limit)
        .offset(pagination.offset)
        .all();
      const taskIds = tasks.map(({ id }) => id);
      if (taskIds.length === 0) {
        return [];
      }
      const [assignments, labels, dependencies, subtasks, recurrences] =
        await Promise.all([
          db.orm.public.TaskAssignee.include("user")
            .where((assignment) => assignment.taskId.in(taskIds))
            .all(),
          db.orm.public.TaskLabel.where((label) =>
            label.taskId.in(taskIds)
          ).all(),
          db.orm.public.TaskDependency.where((dependency) =>
            dependency.taskId.in(taskIds)
          ).all(),
          db.orm.public.TaskSubtask.where((subtask) =>
            subtask.taskId.in(taskIds)
          ).all(),
          db.orm.public.TaskRecurrence.where((recurrence) =>
            recurrence.taskId.in(taskIds)
          ).all(),
        ]);
      const assignmentsByTask = new Map<string, typeof assignments>();
      for (const assignment of assignments) {
        const rows = assignmentsByTask.get(assignment.taskId) ?? [];
        rows.push(assignment);
        assignmentsByTask.set(assignment.taskId, rows);
      }
      const labelsByTask = new Map<string, string[]>();
      for (const label of labels) {
        const ids = labelsByTask.get(label.taskId) ?? [];
        ids.push(label.labelId);
        labelsByTask.set(label.taskId, ids);
      }
      const dependenciesByTask = new Map<string, string[]>();
      for (const dependency of dependencies) {
        const ids = dependenciesByTask.get(dependency.taskId) ?? [];
        ids.push(dependency.dependsOnTaskId);
        dependenciesByTask.set(dependency.taskId, ids);
      }
      const subtasksByTask = new Map<string, typeof subtasks>();
      for (const subtask of subtasks) {
        const rows = subtasksByTask.get(subtask.taskId) ?? [];
        rows.push(subtask);
        subtasksByTask.set(subtask.taskId, rows);
      }
      const recurrencesByTask = new Map(
        recurrences.map((recurrence) => [recurrence.taskId, recurrence])
      );
      return tasks.map((task) => {
        const taskAssignments = assignmentsByTask.get(task.id) ?? [];
        const taskLabels = labelsByTask.get(task.id) ?? [];
        const taskDependencies = dependenciesByTask.get(task.id) ?? [];
        const taskSubtasks = subtasksByTask.get(task.id) ?? [];
        const taskRecurrence = recurrencesByTask.get(task.id);
        return {
          archivedAt: task.archivedAt?.toISOString() ?? null,
          assigneeIds: taskAssignments.map(({ userId }) => userId),
          assignees: taskAssignments.map(({ user }) => ({
            id: user.id,
            name: user.name,
          })),
          completedAt: task.completedAt?.toISOString() ?? null,
          completedSubtaskCount: taskSubtasks.filter(
            ({ isCompleted }) => isCompleted
          ).length,
          createdById: task.createdById,
          dependencyIds: taskDependencies,
          description: task.description,
          dueDate: task.dueDate,
          estimate: task.estimate,
          id: task.id,
          labelIds: taskLabels,
          position: task.position,
          priority: decodeTaskPriority(task.priority),
          projectId: task.projectId,
          projectTaskNumber: task.projectTaskNumber,
          recurrence: taskRecurrence
            ? Schema.decodeUnknownSync(TaskRecurrenceInputSchema)({
                endsOn: taskRecurrence.endsOn,
                frequency: taskRecurrence.frequency,
                interval: taskRecurrence.interval,
                weekDays: Array.isArray(taskRecurrence.weekDays)
                  ? taskRecurrence.weekDays
                  : [],
              })
            : null,
          startDate: task.startDate,
          status: decodeTaskStatus(task.status),
          subtaskCount: taskSubtasks.length,
          title: task.title,
          version: task.version,
        };
      });
    },
  });
