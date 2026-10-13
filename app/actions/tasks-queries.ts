"use server";

import { Effect, Schema } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import { UUIDSchema } from "@/src/server/core/input-schemas";
import { runServerAction } from "@/src/server/core/server-action";
import {
  ProjectTaskListItemSchema,
  WorkManagement,
  WorkManagementLive,
} from "@/src/server/work/work-management";

import {
  ListProjectTasksInputSchema,
  requestHeadersOrFail,
} from "./tasks-shared";

// Reads one live task in a project for the task drawer. Archived tasks are not
// returned, matching the list query.
// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function getProjectTaskAction(input: unknown) {
  return await runServerAction(
    input,
    Schema.Struct({ projectId: UUIDSchema, taskId: UUIDSchema }),
    (validated) =>
      Effect.gen(function* getProjectTask() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const work = yield* WorkManagement;
        const [task] = yield* work.listProjectTasks(
          actor.id,
          validated.projectId,
          {
            includeBugs: true,
            limit: 1,
            offset: 0,
            taskId: validated.taskId,
          }
        );
        if (!task) {
          return yield* Effect.fail(
            new AppError({
              code: "NOT_FOUND",
              message: "The task was not found.",
            })
          );
        }
        return task;
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(WorkManagementLive)
      ),
    undefined,
    ProjectTaskListItemSchema
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listProjectTasksAction(input: unknown) {
  return await runServerAction(
    input,
    ListProjectTasksInputSchema,
    (validated) =>
      Effect.gen(function* listProjectTasks() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const work = yield* WorkManagement;
        return yield* work.listProjectTasks(actor.id, validated.projectId, {
          includeArchived: validated.includeArchived ?? false,
          limit: validated.limit,
          offset: validated.offset,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(WorkManagementLive)
      ),
    undefined,
    Schema.Array(ProjectTaskListItemSchema)
  );
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
