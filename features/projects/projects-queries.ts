import "server-only";
import { Effect, Schema } from "effect";
import { cache } from "react";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
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
