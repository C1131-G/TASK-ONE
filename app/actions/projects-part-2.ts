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
  ProjectMilestonesResultSchema,
  ProjectSummarySchema,
  ProjectWithPeopleSchema,
} from "@/src/server/projects/project-contracts";
import { ProjectManagementLive } from "@/src/server/projects/project-management";

import {
  VersionedProjectActionInputSchema,
  SetProjectPeopleActionInputSchema,
  SaveProjectMilestonesActionInputSchema,
  requestHeadersOrFail,
} from "./projects-shared";

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function restoreProjectAction(input: unknown) {
  const result = await runServerAction(
    input,
    VersionedProjectActionInputSchema,
    (validated) =>
      Effect.gen(function* restoreProject() {
        const requestHeaders = yield* requestHeadersOrFail;
        const administrator = yield* requireAdmin(requestHeaders);
        const projects = yield* ProjectManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...restoreInput } = validated;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            projects.restoreProject(
              administrator.id,
              restoreInput.projectId,
              restoreInput.expectedVersion
            ),
          input: restoreInput,
          key: idempotencyKey,
          operation: "project.restore",
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
export async function setProjectPeopleAction(input: unknown) {
  const result = await runServerAction(
    input,
    SetProjectPeopleActionInputSchema,
    (validated) =>
      Effect.gen(function* updateProjectPeople() {
        const requestHeaders = yield* requestHeadersOrFail;
        const administrator = yield* requireAdmin(requestHeaders);
        const projects = yield* ProjectManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...peopleInput } = validated;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            projects.setProjectPeople(
              administrator.id,
              peopleInput.projectId,
              peopleInput.expectedVersion,
              {
                leadId: peopleInput.leadId,
                memberIds: peopleInput.memberIds,
              }
            ),
          input: peopleInput,
          key: idempotencyKey,
          operation: "project.setPeople",
          resultSchema: ProjectWithPeopleSchema,
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
export async function saveProjectMilestonesAction(input: unknown) {
  const result = await runServerAction(
    input,
    SaveProjectMilestonesActionInputSchema,
    (validated) =>
      Effect.gen(function* saveProjectMilestones() {
        const requestHeaders = yield* requestHeadersOrFail;
        const administrator = yield* requireAdmin(requestHeaders);
        const projects = yield* ProjectManagement;
        const idempotency = yield* Idempotency;
        const { idempotencyKey, ...milestoneInput } = validated;
        return yield* idempotency.run({
          actorId: administrator.id,
          execute: () =>
            projects.saveProjectMilestones(
              administrator.id,
              milestoneInput.projectId,
              milestoneInput.expectedVersion,
              milestoneInput.milestones
            ),
          input: milestoneInput,
          key: idempotencyKey,
          operation: "project.saveMilestones",
          resultSchema: ProjectMilestonesResultSchema,
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
    revalidatePath(`/projects/${result.data.projectId}`);
  }
  return result;
}

// eslint-disable-next-line func-style -- Next Server Actions stay named declarations.
export async function listProjectMilestonesAction(input: unknown) {
  return await runServerAction(
    input,
    Schema.Struct({ projectId: Schema.String.check(Schema.isUUID()) }),
    (validated) =>
      Effect.gen(function* listProjectMilestones() {
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
}
