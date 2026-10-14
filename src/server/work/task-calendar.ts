import { and, or } from "@prisma/orm-postgres/orm-client";
import { Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type {
  TaskCalendarEntry,
  TaskCalendarQuery,
} from "./task-calendar-contracts";
import {
  TaskCalendar,
  TaskPrioritySchema,
  TaskStatusSchema,
} from "./task-calendar-contracts";
import { TaskRecurrenceInputSchema } from "./work-contracts";

export {
  TaskCalendar,
  TaskCalendarEntrySchema,
  TaskCalendarQuerySchema,
} from "./task-calendar-contracts";

const requireCalendarAccess = async (actorId: string): Promise<void> => {
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
};

const getProjects = () =>
  db.orm.public.Project.where({ archivedAt: null }).select("id", "name").all();

const getTasks = (projectIds: readonly string[], query: TaskCalendarQuery) =>
  db.orm.public.Task.where((task) =>
    and(
      task.projectId.in([...projectIds]),
      task.archivedAt.isNull(),
      or(
        and(task.startDate.gte(query.from), task.startDate.lte(query.to)),
        and(task.dueDate.gte(query.from), task.dueDate.lte(query.to)),
        and(task.startDate.lte(query.from), task.dueDate.gte(query.to))
      ),
      ...(query.statuses.length > 0 ? [task.status.in(query.statuses)] : []),
      ...(query.priorities.length > 0
        ? [task.priority.in(query.priorities)]
        : [])
    )
  ).all();

const getAssignments = (
  taskIds: readonly string[],
  assigneeIds: readonly string[] | undefined
) =>
  db.orm.public.TaskAssignee.where((assignment) =>
    and(
      assignment.taskId.in([...taskIds]),
      ...(assigneeIds?.length ? [assignment.userId.in([...assigneeIds])] : [])
    )
  )
    .select("taskId", "userId")
    .all();

const getTaskLabels = (taskIds: readonly string[]) =>
  db.orm.public.TaskLabel.where((label) => label.taskId.in([...taskIds])).all();

const getTaskDependencies = (taskIds: readonly string[]) =>
  db.orm.public.TaskDependency.where((dependency) =>
    dependency.taskId.in([...taskIds])
  ).all();

const getTaskRecurrences = (taskIds: readonly string[]) =>
  db.orm.public.TaskRecurrence.where((recurrence) =>
    recurrence.taskId.in([...taskIds])
  ).all();

const taskGroupKey = (
  groupBy: TaskCalendarQuery["groupBy"],
  status: TaskCalendarEntry["status"],
  projectName: string | undefined,
  assigneeIds: readonly string[]
): string | null => {
  switch (groupBy) {
    case "none": {
      return null;
    }
    case "status": {
      return status;
    }
    case "project": {
      return projectName ?? null;
    }
    case "assignee": {
      return assigneeIds[0] ?? "unassigned";
    }
    default: {
      const _exhaustive: never = groupBy;
      return _exhaustive;
    }
  }
};

const sortCalendarEntries = (
  entries: TaskCalendarEntry[],
  query: TaskCalendarQuery
): TaskCalendarEntry[] => {
  const multiplier = query.sortDirection === "asc" ? 1 : -1;
  entries.sort((left, right) => {
    const leftValue = left[query.sortBy] ?? "";
    const rightValue = right[query.sortBy] ?? "";
    return (
      multiplier *
      (typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue)))
    );
  });
  return entries.slice(0, query.limit);
};

const mapCalendarEntries = ({
  query,
  projects,
  rows,
  assignments,
  labels,
  dependencies,
  recurrences,
}: {
  readonly query: TaskCalendarQuery;
  readonly projects: Awaited<ReturnType<typeof getProjects>>;
  readonly rows: Awaited<ReturnType<typeof getTasks>>;
  readonly assignments: Awaited<ReturnType<typeof getAssignments>>;
  readonly labels: Awaited<ReturnType<typeof getTaskLabels>>;
  readonly dependencies: Awaited<ReturnType<typeof getTaskDependencies>>;
  readonly recurrences: Awaited<ReturnType<typeof getTaskRecurrences>>;
}): readonly TaskCalendarEntry[] => {
  const taskIds = rows.map(({ id }) => id);
  const matchingTaskIds = new Set(
    query.assigneeIds?.length
      ? assignments.map(({ taskId }) => taskId)
      : taskIds
  );
  const assignmentsByTask = new Map<string, string[]>();
  for (const assignment of assignments) {
    const ids = assignmentsByTask.get(assignment.taskId) ?? [];
    ids.push(assignment.userId);
    assignmentsByTask.set(assignment.taskId, ids);
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
  const recurrencesByTask = new Map(
    recurrences.map((recurrence) => [recurrence.taskId, recurrence])
  );
  const projectsById = new Map(
    projects.map((project) => [project.id, project])
  );
  const entries: TaskCalendarEntry[] = [];
  for (const task of rows) {
    if (!matchingTaskIds.has(task.id)) {
      continue;
    }
    const assigneeIds = assignmentsByTask.get(task.id) ?? [];
    const taskRecurrence = recurrencesByTask.get(task.id);
    const project = projectsById.get(task.projectId);
    const status = Schema.decodeUnknownSync(TaskStatusSchema)(task.status);
    const priority = Schema.decodeUnknownSync(TaskPrioritySchema)(
      task.priority
    );
    entries.push({
      assigneeIds,
      createdById: task.createdById,
      dependencyIds: dependenciesByTask.get(task.id) ?? [],
      dueDate: task.dueDate,
      groupKey: taskGroupKey(query.groupBy, status, project?.name, assigneeIds),
      id: task.id,
      labelIds: labelsByTask.get(task.id) ?? [],
      position: task.position,
      priority,
      projectId: task.projectId,
      projectName: project?.name ?? "",
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
      status,
      title: task.title,
      version: task.version,
    });
  }
  return sortCalendarEntries(entries, query);
};

const loadCalendarEntries = async (
  query: TaskCalendarQuery
): Promise<readonly TaskCalendarEntry[]> => {
  const projects = await getProjects();
  const requestedProjectIds = new Set(query.projectIds);
  const projectIds: string[] = [];
  for (const project of projects) {
    if (!query.projectIds || requestedProjectIds.has(project.id)) {
      projectIds.push(project.id);
    }
  }
  if (projectIds.length === 0) {
    return [];
  }

  const rows = await getTasks(projectIds, query);
  if (rows.length === 0) {
    return [];
  }
  const taskIds = rows.map(({ id }) => id);
  const [assignments, labels, dependencies, recurrences] = await Promise.all([
    getAssignments(taskIds, query.assigneeIds),
    getTaskLabels(taskIds),
    getTaskDependencies(taskIds),
    getTaskRecurrences(taskIds),
  ]);
  return mapCalendarEntries({
    assignments,
    dependencies,
    labels,
    projects,
    query,
    recurrences,
    rows,
  });
};

const list: TaskCalendar["Service"]["list"] = (actorId, query) =>
  Effect.tryPromise({
    catch: (error) =>
      error instanceof AppError
        ? error
        : new AppError({
            code: "UNAVAILABLE",
            message: "The task calendar could not be loaded.",
          }),
    try: async () => {
      await requireCalendarAccess(actorId);
      if (query.from > query.to) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "The calendar range is invalid.",
        });
      }
      return loadCalendarEntries(query);
    },
  });

export const TaskCalendarLive = Layer.succeed(
  TaskCalendar,
  TaskCalendar.of({ list })
);
