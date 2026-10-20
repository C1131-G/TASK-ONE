import "server-only";
import { Effect } from "effect";
import { refresh, revalidatePath } from "next/cache";

import { AuthSessionLive } from "@/src/server/auth/session";
import { requireAdmin } from "@/src/server/core/admin-action";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import { requestHeadersOrFail } from "@/src/server/core/request-headers";
import {
  ServerActionOutputSchema,
  runServerAction,
} from "@/src/server/core/server-action";
import {
  ProjectManagement,
  ProjectSummarySchema,
} from "@/src/server/projects/project-contracts";
import { ProjectManagementLive } from "@/src/server/projects/project-management";

import {
  UpdateProjectActionInputSchema,
  VersionedProjectActionInputSchema,
  DuplicateProjectActionInputSchema,
  CreateProjectActionInputSchema,
} from "./projects-action-schemas";

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
    refresh();
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
    refresh();
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
                color: updateInput.color,
                description: updateInput.description,
                dueDate: updateInput.dueDate,
                icon: updateInput.icon,
                name: updateInput.name,
                position: updateInput.position,
                startDate: updateInput.startDate,
                status: updateInput.status,
                teamId: updateInput.teamId,
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
    refresh();
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
    refresh();
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
