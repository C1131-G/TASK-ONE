import { and, or } from "@prisma/orm-postgres/orm-client";
import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { CalendarDateSchema } from "../core/input-schemas";

const TaskStatusSchema = Schema.Literals([
  "backlog",
  "todo",
  "progress",
  "review",
  "done",
]);
const TaskPrioritySchema = Schema.Literals([
  "urgent",
  "high",
  "medium",
  "low",
  "none",
]);

export const TaskCalendarQuerySchema = Schema.Struct({
  assigneeIds: Schema.optional(
    Schema.Array(Schema.String.check(Schema.isUUID())).check(
      Schema.isMaxLength(100)
    )
  ),
  from: CalendarDateSchema,
  groupBy: Schema.Literals(["none", "status", "project", "assignee"]),
  limit: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(1),
    Schema.isLessThanOrEqualTo(200)
  ),
  priorities: Schema.Array(TaskPrioritySchema).check(Schema.isMaxLength(5)),
  projectIds: Schema.optional(
    Schema.Array(Schema.String.check(Schema.isUUID())).check(
      Schema.isMaxLength(100)
    )
  ),
  sortBy: Schema.Literals(["startDate", "dueDate", "title", "position"]),
  sortDirection: Schema.Literals(["asc", "desc"]),
  statuses: Schema.Array(TaskStatusSchema).check(Schema.isMaxLength(5)),
  to: CalendarDateSchema,
});

export type TaskCalendarQuery = typeof TaskCalendarQuerySchema.Type;

export const TaskCalendarEntrySchema = Schema.Struct({
  assigneeIds: Schema.Array(Schema.String),
  dueDate: Schema.NullOr(Schema.String),
  groupKey: Schema.NullOr(Schema.String),
  id: Schema.String,
  position: Schema.Number,
  priority: TaskPrioritySchema,
  projectId: Schema.String,
  projectName: Schema.String,
  startDate: Schema.NullOr(Schema.String),
  status: TaskStatusSchema,
  title: Schema.String,
});

export type TaskCalendarEntry = typeof TaskCalendarEntrySchema.Type;

export class TaskCalendar extends Context.Service<
  TaskCalendar,
  {
    readonly list: (
      actorId: string,
      query: TaskCalendarQuery
    ) => Effect.Effect<readonly TaskCalendarEntry[], AppError>;
  }
>()("metsys/server/TaskCalendar") {}

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

const taskGroupKey = (
  groupBy: TaskCalendarQuery["groupBy"],
  status: TaskCalendarEntry["status"],
  projectName: string | undefined,
  assigneeIds: readonly string[]
): string | null => {
  switch (groupBy) {
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
      return null;
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
  const assignments = await getAssignments(taskIds, query.assigneeIds);
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
  const projectsById = new Map(
    projects.map((project) => [project.id, project])
  );
  const entries: TaskCalendarEntry[] = [];
  for (const task of rows) {
    if (!matchingTaskIds.has(task.id)) {
      continue;
    }
    const assigneeIds = assignmentsByTask.get(task.id) ?? [];
    const project = projectsById.get(task.projectId);
    const status = Schema.decodeUnknownSync(TaskStatusSchema)(task.status);
    const priority = Schema.decodeUnknownSync(TaskPrioritySchema)(
      task.priority
    );
    entries.push({
      assigneeIds,
      dueDate: task.dueDate,
      groupKey: taskGroupKey(query.groupBy, status, project?.name, assigneeIds),
      id: task.id,
      position: task.position,
      priority,
      projectId: task.projectId,
      projectName: project?.name ?? "",
      startDate: task.startDate,
      status,
      title: task.title,
    });
  }
  return sortCalendarEntries(entries, query);
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
