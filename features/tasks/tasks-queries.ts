import "server-only";
import { Effect, Schema } from "effect";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import { UUIDSchema } from "@/src/server/core/input-schemas";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  LabelManagement,
  LabelManagementLive,
  LabelSummarySchema,
} from "@/src/server/tasks/label-management";
import {
  ProjectTaskListItemSchema,
  WorkManagement,
  WorkManagementLive,
} from "@/src/server/work/work-management";

import { ListProjectTasksInputSchema } from "./actions/task-action-schemas";

export const getProjectTask = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({ projectId: UUIDSchema, taskId: UUIDSchema }),
    (validated) =>
      Effect.gen(function* getProjectTaskProgram() {
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

export const listProjectTasks = async (input: unknown) =>
  await runServerAction(
    input,
    ListProjectTasksInputSchema,
    (validated) =>
      Effect.gen(function* listProjectTasksProgram() {
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

export const listLabels = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({}),
    () =>
      Effect.gen(function* listLabelsProgram() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const labels = yield* LabelManagement;
        return yield* labels.list(user.id);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(LabelManagementLive)
      ),
    undefined,
    Schema.Array(LabelSummarySchema)
  );

const TASK_PAGE_SIZE = 200;

type ProjectTask = Extract<
  Awaited<ReturnType<typeof listProjectTasks>>,
  { readonly ok: true }
>["data"][number];

// Pages through every task in a project. Undefined when any page fails, so
// callers never render a partial list as if it were complete.
export const listAllProjectTasks = async (
  projectId: string,
  options: { readonly includeArchived?: boolean } = {}
): Promise<readonly ProjectTask[] | undefined> => {
  const tasks: ProjectTask[] = [];
  let offset = 0;
  while (true) {
    // eslint-disable-next-line no-await-in-loop -- Each page offset depends on the prior result.
    const result = await listProjectTasks({
      ...(options.includeArchived ? { includeArchived: true } : {}),
      limit: TASK_PAGE_SIZE,
      offset,
      projectId,
    });
    if (!result.ok) {
      return undefined;
    }
    tasks.push(...result.data);
    if (result.data.length < TASK_PAGE_SIZE) {
      return tasks;
    }
    offset += TASK_PAGE_SIZE;
  }
};

// Loads every page of a project's tasks in parallel, sized by the known count.
export const listProjectTaskPages = async (
  projectId: string,
  taskCount: number
): Promise<Awaited<ReturnType<typeof listProjectTasks>>> => {
  const pageSize = 200;
  const pageCount = Math.max(1, Math.ceil(taskCount / pageSize));
  const results = await Promise.all(
    Array.from({ length: pageCount }, (_, pageIndex) =>
      listProjectTasks({
        limit: pageSize,
        offset: pageIndex * pageSize,
        projectId,
      })
    )
  );
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
  }
  const [firstResult] = results;
  if (!firstResult) {
    throw new Error("Project task pagination returned no page results.");
  }
  if (!firstResult.ok) {
    return firstResult;
  }
  return {
    data: results.flatMap((result) => (result.ok ? result.data : [])),
    ok: true,
    requestId: firstResult.requestId,
  };
};
