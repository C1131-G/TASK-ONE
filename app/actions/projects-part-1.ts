"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { requireAdmin } from "@/src/server/core/admin-action";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import {
  ServerActionOutputSchema,
  runServerAction,
} from "@/src/server/core/server-action";
import {
  ProjectManagement,
  ProjectListItemSchema,
  ProjectSummarySchema,
} from "@/src/server/projects/project-contracts";
import { ProjectManagementLive } from "@/src/server/projects/project-management";

import {
  UpdateProjectActionInputSchema,
  VersionedProjectActionInputSchema,
  DuplicateProjectActionInputSchema,
  CreateProjectActionInputSchema,
  requestHeadersOrFail,
} from "./projects-shared";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listProjectsAction(input: unknown) {
  return await runServerAction(
    input,
    Schema.Struct({ includeArchived: Schema.optional(Schema.Boolean) }),
    (validated) =>
      Effect.gen(function* listProjects() {
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
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function createProjectAction(input: unknown) {
  const result = await runServerAction(
    input,
    CreateProjectActionInputSchema,
    (validated) =>
      Effect.gen(function* createProject() {
        const requestHeaders = yield* requestHeadersOrFail;
        const administrator = yield* requireAdmin(requestHeaders);
        const projects = yield* ProjectManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...projectInput } = validated;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () => projects.createProject(administrator.id, projectInput),
          input: projectInput,
          key: idempotencyKey,
          operation: "project.create",
          resultSchema: ProjectSummarySchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(ProjectManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ServerActionOutputSchema
  );

  if (result.ok) {
    revalidatePath("/projects");
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function duplicateProjectAction(input: unknown) {
  const result = await runServerAction(
    input,
    DuplicateProjectActionInputSchema,
    (validated) =>
      Effect.gen(function* duplicateProject() {
        const requestHeaders = yield* requestHeadersOrFail;
        const administrator = yield* requireAdmin(requestHeaders);
        const projects = yield* ProjectManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...duplicateInput } = validated;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            projects.duplicateProject(
              administrator.id,
              duplicateInput.sourceProjectId,
              { key: duplicateInput.key, name: duplicateInput.name }
            ),
          input: duplicateInput,
          key: idempotencyKey,
          operation: "project.duplicate",
          resultSchema: ProjectSummarySchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(ProjectManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ServerActionOutputSchema
  );
  if (result.ok) {
    revalidatePath("/projects");
    revalidatePath(`/projects/${result.data.id}`);
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function updateProjectAction(input: unknown) {
  const result = await runServerAction(
    input,
    UpdateProjectActionInputSchema,
    (validated) =>
      Effect.gen(function* updateProject() {
        const requestHeaders = yield* requestHeadersOrFail;
        const administrator = yield* requireAdmin(requestHeaders);
        const projects = yield* ProjectManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...updateInput } = validated;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            projects.updateProject(
              administrator.id,
              updateInput.projectId,
              updateInput.expectedVersion,
              {
                description: updateInput.description,
                name: updateInput.name,
                status: updateInput.status,
              }
            ),
          input: updateInput,
          key: idempotencyKey,
          operation: "project.update",
          resultSchema: ProjectSummarySchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(ProjectManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ServerActionOutputSchema
  );
  if (result.ok) {
    revalidatePath("/projects");
    revalidatePath(`/projects/${result.data.id}`);
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function archiveProjectAction(input: unknown) {
  const result = await runServerAction(
    input,
    VersionedProjectActionInputSchema,
    (validated) =>
      Effect.gen(function* archiveProject() {
        const requestHeaders = yield* requestHeadersOrFail;
        const administrator = yield* requireAdmin(requestHeaders);
        const projects = yield* ProjectManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...archiveInput } = validated;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            projects.archiveProject(
              administrator.id,
              archiveInput.projectId,
              archiveInput.expectedVersion
            ),
          input: archiveInput,
          key: idempotencyKey,
          operation: "project.archive",
          resultSchema: ProjectSummarySchema,
        });
      }).pipe(
        Effect.provide(AuthSessionLive),
        Effect.provide(ProjectManagementLive),
        Effect.provide(IdempotencyLive)
      ),
    undefined,
    ServerActionOutputSchema
  );
  if (result.ok) {
    revalidatePath("/projects");
    revalidatePath(`/projects/${result.data.id}`);
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
