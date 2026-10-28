import { Context, Effect, Layer } from "effect";

import { AppError } from "../core/action-result";

export interface TaskEditor {
  readonly id: string;
  readonly role: "admin" | "employee";
  readonly isActive: boolean;
}

export interface TaskAccess {
  readonly creatorId: string;
  readonly assigneeIds: readonly string[];
  readonly isArchived: boolean;
}

// The one rule for who may edit a task: an admin, the person who created it, or
// someone assigned to it. Every place that decides this calls this function (or
// `mayEditTaskRow`, which loads the assignment first), so they cannot drift.
export const mayEditTask = (
  editor: { readonly id: string; readonly role: string },
  task: {
    readonly creatorId: string;
    readonly assigneeIds: readonly string[];
  }
): boolean =>
  editor.role === "admin" ||
  task.creatorId === editor.id ||
  task.assigneeIds.includes(editor.id);

export class TaskPermissions extends Context.Service<
  TaskPermissions,
  {
    readonly requireEdit: (
      editor: TaskEditor,
      task: TaskAccess
    ) => Effect.Effect<void, AppError>;
  }
>()("metsys/server/TaskPermissions") {}

export const TaskPermissionsLive = Layer.succeed(
  TaskPermissions,
  TaskPermissions.of({
    requireEdit: (editor, task) => {
      if (!editor.isActive) {
        return Effect.fail(
          new AppError({
            code: "UNAUTHENTICATED",
            message: "Sign in to continue.",
          })
        );
      }

      if (task.isArchived) {
        return Effect.fail(
          new AppError({
            code: "FORBIDDEN",
            message: "Archived tasks must be restored before editing.",
          })
        );
      }

      if (!mayEditTask(editor, task)) {
        return Effect.fail(
          new AppError({
            code: "FORBIDDEN",
            message: "You cannot edit this task.",
          })
        );
      }

      return Effect.void;
    },
  })
);
