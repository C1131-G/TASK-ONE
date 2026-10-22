import { and } from "@prisma/orm-postgres/orm-client";
import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { loadCustomFieldColumns } from "../custom-fields/custom-field-export";
import { TaskPrioritySchema, TaskStatusSchema } from "../work/work-contracts";
import { databaseError } from "../work/work-internal";
import { createTaskInTransaction } from "../work/work-task-creation";
import { formatCsv, parseTaskImport } from "./csv";
import type { ImportRowError, ImportedTaskRow } from "./csv";

export const MAX_EXPORT_ROWS = 10_000;
const EXPORT_HEADER = [
  "project",
  "number",
  "title",
  "description",
  "status",
  "priority",
  "start_date",
  "due_date",
  "assignees",
  "created_at",
] as const;

// Mirrors the filters on the Tasks page, so an export matches what is on screen.
export const TaskCsvFiltersSchema = Schema.Struct({
  overdue: Schema.optional(Schema.Boolean),
  priority: Schema.optional(TaskPrioritySchema),
  projectId: Schema.optional(Schema.String.check(Schema.isUUID())),
  q: Schema.optional(Schema.String.check(Schema.isMaxLength(200))),
  status: Schema.optional(TaskStatusSchema),
});
export type TaskCsvFilters = typeof TaskCsvFiltersSchema.Type;

export interface TaskImportResult {
  readonly created: number;
  readonly errors: readonly ImportRowError[];
}

const unavailable = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The task file could not be prepared.",
      });

// Same gate as the task pages: an active employee or administrator who has
// finished onboarding. Clients never reach internal task data.
const requireWorkspaceUser = async (actorId: string): Promise<void> => {
  const actor = await db.orm.public.User.where({ id: actorId })
    .select("deactivatedAt", "mustChangePassword", "role")
    .first();
  if (!actor || actor.deactivatedAt || actor.role === "client") {
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

const matchesText = (
  query: string | undefined,
  title: string,
  projectName: string,
  projectKey: string
): boolean =>
  !query?.trim() ||
  `${title} ${projectName} ${projectKey}`
    .toLocaleLowerCase()
    .includes(query.trim().toLocaleLowerCase());

const exportTasks = (
  actorId: string,
  filters: TaskCsvFilters,
  today: string
): Effect.Effect<string, AppError> =>
  Effect.tryPromise({
    catch: unavailable,
    try: async () => {
      await requireWorkspaceUser(actorId);
      const projects = await db.orm.public.Project.where({ archivedAt: null })
        .select("id", "key", "name")
        .all();
      const activeProjects = new Map(
        projects.flatMap((project) =>
          !filters.projectId || project.id === filters.projectId
            ? [[project.id, project] as const]
            : []
        )
      );
      if (activeProjects.size === 0) {
        return formatCsv([EXPORT_HEADER]);
      }
      const tasks = await db.orm.public.Task.where((task) =>
        and(
          task.projectId.in([...activeProjects.keys()]),
          task.archivedAt.isNull(),
          task.type.eq("task"),
          ...(filters.status ? [task.status.eq(filters.status)] : []),
          ...(filters.priority ? [task.priority.eq(filters.priority)] : []),
          ...(filters.overdue
            ? [
                task.status.neq("done"),
                task.dueDate.isNotNull(),
                task.dueDate.lt(today),
              ]
            : [])
        )
      )
        .orderBy((task) => task.projectId.asc())
        .orderBy((task) => task.projectTaskNumber.asc())
        .limit(MAX_EXPORT_ROWS + 1)
        .all();
      const matching = tasks.filter((task) => {
        const project = activeProjects.get(task.projectId);
        return (
          project !== undefined &&
          matchesText(filters.q, task.title, project.name, project.key)
        );
      });
      if (matching.length > MAX_EXPORT_ROWS) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: `Too many tasks to export at once. Narrow the filters to ${MAX_EXPORT_ROWS.toLocaleString("en-US")} tasks or fewer.`,
        });
      }
      const assignments =
        matching.length === 0
          ? []
          : await db.orm.public.TaskAssignee.where((assignment) =>
              assignment.taskId.in(matching.map(({ id }) => id))
            )
              .select("taskId", "userId")
              .all();
      const users =
        assignments.length === 0
          ? []
          : await db.orm.public.User.where((user) =>
              user.id.in([...new Set(assignments.map(({ userId }) => userId))])
            )
              .select("id", "email")
              .all();
      const emails = new Map(users.map(({ email, id }) => [id, email]));
      const assigneesByTask = new Map<string, string[]>();
      for (const { taskId, userId } of assignments) {
        assigneesByTask.set(taskId, [
          ...(assigneesByTask.get(taskId) ?? []),
          emails.get(userId) ?? "",
        ]);
      }
      const custom = await loadCustomFieldColumns(
        new Map([...activeProjects].map(([id, { key }]) => [id, key])),
        matching
      );
      return formatCsv([
        [...EXPORT_HEADER, ...custom.header],
        ...matching.map((task) => [
          activeProjects.get(task.projectId)?.key ?? "",
          task.projectTaskNumber,
          task.title,
          task.description,
          task.status,
          task.priority,
          task.startDate,
          task.dueDate,
          (assigneesByTask.get(task.id) ?? []).filter(Boolean).join("; "),
          task.createdAt.toISOString(),
          ...custom.cells(task),
        ]),
      ]);
    },
  });

const resolveAssignees = async (
  rows: readonly ImportedTaskRow[]
): Promise<{
  readonly errors: readonly ImportRowError[];
  readonly idsByEmail: ReadonlyMap<string, string>;
}> => {
  const wanted = [
    ...new Set(rows.flatMap(({ assigneeEmails }) => assigneeEmails)),
  ];
  const users =
    wanted.length === 0
      ? []
      : await db.orm.public.User.where((user) =>
          user.emailNormalized.in(wanted)
        )
          .select("id", "emailNormalized", "deactivatedAt", "role")
          .all();
  const idsByEmail = new Map(
    users.flatMap(({ deactivatedAt, emailNormalized, id, role }) =>
      !deactivatedAt && role !== "client" && emailNormalized
        ? [[emailNormalized, id] as const]
        : []
    )
  );
  const errors = rows.flatMap(({ assigneeEmails, line }) => {
    const unknown = assigneeEmails.filter((email) => !idsByEmail.has(email));
    return unknown.length > 0
      ? [
          {
            column: "assignees",
            line,
            message: `No active employee has the email ${unknown.join(", ")}.`,
          },
        ]
      : [];
  });
  return { errors, idsByEmail };
};

const importTasks = (
  actorId: string,
  projectId: string,
  text: string
): Effect.Effect<TaskImportResult, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async (): Promise<TaskImportResult> => {
      await requireWorkspaceUser(actorId);
      const project = Schema.is(Schema.String.check(Schema.isUUID()))(projectId)
        ? await db.orm.public.Project.where({ archivedAt: null, id: projectId })
            .select("id")
            .first()
        : null;
      if (!project) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "The active project was not found.",
        });
      }
      const parsed = parseTaskImport(text);
      const { errors: assigneeErrors, idsByEmail } = await resolveAssignees(
        parsed.rows
      );
      const errors = [...parsed.errors, ...assigneeErrors].toSorted(
        (left, right) => left.line - right.line
      );
      if (errors.length > 0) {
        return { created: 0, errors };
      }
      // One transaction: either every row becomes a task or none does.
      await db.transaction(async (transaction) => {
        for (const row of parsed.rows) {
          // Rows are created in file order so task numbers follow the file.
          // oxlint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop -- Each row needs the next task number, so rows are created in order.
          const created = await createTaskInTransaction(
            transaction,
            actorId,
            {
              assigneeIds: row.assigneeEmails.flatMap((email) => {
                const id = idsByEmail.get(email);
                return id ? [id] : [];
              }),
              description: row.description,
              dueDate: row.dueDate,
              priority: row.priority,
              projectId,
              startDate: row.startDate,
              title: row.title,
            },
            "task",
            row.status
          );
          if (row.status === "done") {
            // eslint-disable-next-line no-await-in-loop
            await transaction.orm.public.Task.where({
              id: created.id,
            }).updateAndCount({ completedAt: new Date() });
          }
        }
      });
      return { created: parsed.rows.length, errors: [] };
    },
  });

export class TaskCsv extends Context.Service<
  TaskCsv,
  {
    readonly exportTasks: (
      actorId: string,
      filters: TaskCsvFilters,
      today: string
    ) => Effect.Effect<string, AppError>;
    readonly importTasks: (
      actorId: string,
      projectId: string,
      text: string
    ) => Effect.Effect<TaskImportResult, AppError>;
  }
>()("metsys/server/TaskCsv") {}

export const TaskCsvLive = Layer.succeed(TaskCsv, { exportTasks, importTasks });
