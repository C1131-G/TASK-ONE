import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import type { MobileTaskContext } from "../../mobile-api/routes-tasks";
import { listComments } from "../collaboration/list-comments";
import { AppError } from "../core/action-result";
import { TaskPermissions, TaskPermissionsLive } from "../tasks/permissions";
import { listSubtasks } from "../tasks/subtask-list-subtasks";
import { decodeTaskPriority, decodeTaskStatus } from "./work-contracts";
import { databaseError } from "./work-internal";

type TaskAction = MobileTaskContext["permittedActions"][number];

export interface ContextViewer {
  readonly id: string;
  readonly role: "admin" | "employee";
}

interface ActionSubject {
  readonly createdById: string;
  readonly assigneeIds: readonly string[];
  readonly isArchived: boolean;
  readonly type: string;
  readonly isClientBug: boolean;
}

// What the viewer may do with the task. Editing follows TaskPermissions, so
// the app shows exactly the actions the services will accept.
const permittedActionsOf = (
  viewer: ContextViewer,
  task: ActionSubject
): Effect.Effect<readonly TaskAction[]> =>
  Effect.gen(function* resolveActions() {
    if (task.isArchived) {
      return [];
    }
    const permissions = yield* TaskPermissions;
    const mayEdit = yield* permissions
      .requireEdit(
        { id: viewer.id, isActive: true, role: viewer.role },
        {
          assigneeIds: task.assigneeIds,
          creatorId: task.createdById,
          isArchived: task.isArchived,
        }
      )
      .pipe(
        Effect.as(true),
        Effect.catch(() => Effect.succeed(false))
      );
    // A client bug belongs to its handler: other employees only follow along.
    const mayComment =
      !task.isClientBug ||
      viewer.role === "admin" ||
      task.assigneeIds.includes(viewer.id);
    const actions: TaskAction[] = [];
    // Only a plain task is edited or given subtasks; a bug has its own workflow.
    if (mayEdit && task.type === "task") {
      actions.push("update", "manageSubtasks");
    }
    if (mayComment) {
      actions.push("comment");
    }
    actions.push("trackTime");
    return actions;
  }).pipe(Effect.provide(TaskPermissionsLive));

export const getTaskContext = (
  viewer: ContextViewer,
  taskId: string
): Effect.Effect<MobileTaskContext, AppError> =>
  Effect.gen(function* loadContext() {
    const task = yield* Effect.tryPromise({
      catch: databaseError,
      try: () =>
        db.orm.public.Task.include("project").where({ id: taskId }).first(),
    });
    if (!task) {
      return yield* new AppError({
        code: "NOT_FOUND",
        message: "The task was not found.",
      });
    }
    const [assignments, bug] = yield* Effect.tryPromise({
      catch: databaseError,
      try: () =>
        Promise.all([
          db.orm.public.TaskAssignee.include("user").where({ taskId }).all(),
          db.orm.public.BugReport.where({ taskId })
            .select("clientCompanyId")
            .first(),
        ]),
    });
    const subtasks = yield* listSubtasks(viewer.id, taskId);
    const comments = yield* listComments(viewer.id, taskId);
    const assigneeIds = assignments.map(({ userId }) => userId);
    const isArchived = Boolean(task.archivedAt ?? task.project.archivedAt);
    const permittedActions = yield* permittedActionsOf(viewer, {
      assigneeIds,
      createdById: task.createdById,
      isArchived,
      isClientBug: Boolean(bug?.clientCompanyId),
      type: task.type,
    });
    return {
      assignees: assignments
        .map(({ user }) => ({ id: user.id, name: user.name }))
        .toSorted((left, right) => left.name.localeCompare(right.name)),
      createdById: task.createdById,
      description: task.description,
      discussion: comments.map((comment) => ({
        authorId: comment.authorId,
        authorName: comment.authorName,
        body: comment.body,
        createdAt: comment.createdAt,
        id: comment.id,
        visibility: comment.visibility,
      })),
      dueDate: task.dueDate,
      id: task.id,
      isArchived,
      permittedActions,
      priority: decodeTaskPriority(task.priority),
      projectId: task.projectId,
      projectName: task.project.name,
      reference: `${task.project.key}-${task.projectTaskNumber}`,
      startDate: task.startDate,
      status: decodeTaskStatus(task.status),
      subtasks,
      title: task.title,
      type: task.type,
      version: task.version,
    };
  });
