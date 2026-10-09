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

      const mayEdit =
        editor.role === "admin" ||
        task.creatorId === editor.id ||
        task.assigneeIds.includes(editor.id);

      if (!mayEdit) {
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
