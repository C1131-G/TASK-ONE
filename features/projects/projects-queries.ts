import "server-only";
import { Effect, Schema } from "effect";
import { notFound } from "next/navigation";
import { cache } from "react";

import { readOrThrow } from "@/lib/read-result";
import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import {
  BudgetListRowSchema,
  ProjectBudgetViewSchema,
  ProjectIdInputSchema,
} from "@/src/server/budgets/budget-contracts";
import {
  ProjectBudgets,
  ProjectBudgetsLive,
} from "@/src/server/budgets/project-budgets";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import { runServerAction } from "@/src/server/core/server-action";
import {
  SavedViewManagement,
  SavedViewManagementLive,
  SavedViewSummarySchema,
} from "@/src/server/preferences/saved-view-management";
import {
  ProjectListItemSchema,
  ProjectManagement,
  ProjectMilestonesResultSchema,
} from "@/src/server/projects/project-contracts";
import { ProjectManagementLive } from "@/src/server/projects/project-management";

export const listProjects = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({ includeArchived: Schema.optional(Schema.Boolean) }),
    (validated) =>
      Effect.gen(function* listProjectsProgram() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const projects = yield* ProjectManagement;
        return yield* projects.listProjects(actor.id, {
          includeArchived: validated.includeArchived ?? false,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(ProjectManagementLive)
      ),
    undefined,
    Schema.Array(ProjectListItemSchema)
  );

export const listProjectMilestones = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({ projectId: Schema.String.check(Schema.isUUID()) }),
    (validated) =>
      Effect.gen(function* listProjectMilestonesProgram() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const projects = yield* ProjectManagement;
        return yield* projects.listProjectMilestones(
          actor.id,
          validated.projectId
        );
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(ProjectManagementLive)
      ),
    undefined,
    ProjectMilestonesResultSchema
  );

// Administrators and members of the project see its burn; clients never do.
export const getProjectBudget = async (input: unknown) =>
  await runServerAction(
    input,
    ProjectIdInputSchema,
    ({ projectId }) =>
      Effect.gen(function* getBudget() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const budgets = yield* ProjectBudgets;
        return yield* budgets.get(actor.id, projectId, new Date());
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(ProjectBudgetsLive)
      ),
    undefined,
    Schema.NullOr(ProjectBudgetViewSchema)
  );

export const listProjectBudgets = async (input: unknown) =>
  await runServerAction(
    input,
    Schema.Struct({}),
    () =>
      Effect.gen(function* listBudgets() {
        const sessions = yield* AuthSession;
        const actor = yield* sessions.requireWorkspaceAccess(
          yield* requestHeadersOrFail
        );
        const budgets = yield* ProjectBudgets;
        return yield* budgets.list(actor.id, new Date());
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(ProjectBudgetsLive)
      ),
    undefined,
    Schema.Array(BudgetListRowSchema)
  );

export const listSavedViews = async (input: unknown) => {
  const result = await runServerAction(
    input,
    Schema.Struct({}),
    () =>
      Effect.gen(function* listViews() {
        const requestHeaders = yield* requestHeadersOrFail;
        const sessions = yield* AuthSession;
        const user = yield* sessions.requireWorkspaceAccess(requestHeaders);
        const views = yield* SavedViewManagement;
        return yield* views.listViews(user.id);
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(SavedViewManagementLive)
      ),
    undefined,
    Schema.Array(SavedViewSummarySchema)
  );
  return result;
};

// Project pages read the full list for their title and their body; one
// request shares a single read.
export const listAllProjects = cache(async () => await listProjects({}));

// The project pages' single record. Its existence is decided here, so a
// missing or malformed id renders the segment's not-found page.
export const getProject = cache(async (projectId: string) => {
  const projects = readOrThrow(await listAllProjects(), "Projects");
  const project = projects.find(({ id }) => id === projectId);
  if (!project) {
    notFound();
  }
  return project;
});

// The header and the body both resolve the active view; one request reads the
// saved views once.
export const listAllSavedViews = cache(async () => await listSavedViews({}));
