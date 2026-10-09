"use server";

import { Effect, Schema } from "effect";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AuthSession, AuthSessionLive } from "@/src/server/auth/session";
import { AppError } from "@/src/server/core/action-result";
import { requireAdmin } from "@/src/server/core/admin-action";
import { Idempotency, IdempotencyLive } from "@/src/server/core/idempotency";
import {
  CalendarDateSchema,
  IdempotencyKeySchema,
  UUIDSchema,
} from "@/src/server/core/input-schemas";
import {
  ServerActionOutputSchema,
  runServerAction,
} from "@/src/server/core/server-action";
import {
  CreateProjectInputSchema,
  DuplicateProjectInputSchema,
  ProjectManagement,
  ProjectManagementLive,
  ProjectListItemSchema,
  ProjectMilestonesResultSchema,
  ProjectSummarySchema,
  ProjectWithPeopleSchema,
  SaveProjectMilestonesInputSchema,
} from "@/src/server/projects/project-management";

const UpdateProjectActionInputSchema = Schema.Struct({
  color: Schema.optional(Schema.String.check(Schema.isMaxLength(40))),
  description: Schema.NullOr(Schema.String),
  dueDate: Schema.optional(Schema.NullOr(CalendarDateSchema)),
  expectedVersion: Schema.Number,
  icon: Schema.optional(Schema.String.check(Schema.isMaxLength(40))),
  idempotencyKey: IdempotencyKeySchema,
  name: Schema.String,
  position: Schema.optional(
    Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))
  ),
  projectId: UUIDSchema,
  startDate: Schema.optional(Schema.NullOr(CalendarDateSchema)),
  status: Schema.Literals(["planning", "active", "risk", "hold", "complete"]),
  teamId: Schema.optional(Schema.NullOr(UUIDSchema)),
});

const VersionedProjectActionInputSchema = Schema.Struct({
  expectedVersion: Schema.Number,
  idempotencyKey: IdempotencyKeySchema,
  projectId: UUIDSchema,
});

const SetProjectPeopleActionInputSchema = Schema.Struct({
  expectedVersion: Schema.Number,
  idempotencyKey: IdempotencyKeySchema,
  leadId: Schema.NullOr(UUIDSchema),
  memberIds: Schema.Array(UUIDSchema),
  projectId: UUIDSchema,
});

const DuplicateProjectActionInputSchema = Schema.Struct({
  idempotencyKey: IdempotencyKeySchema,
  sourceProjectId: UUIDSchema,
  ...DuplicateProjectInputSchema.fields,
});

const CreateProjectActionInputSchema = Schema.Struct({
  ...CreateProjectInputSchema.fields,
  idempotencyKey: IdempotencyKeySchema,
});

const SaveProjectMilestonesActionInputSchema = Schema.Struct({
  ...SaveProjectMilestonesInputSchema.fields,
  idempotencyKey: IdempotencyKeySchema,
});

const requestHeadersOrFail = Effect.tryPromise({
  catch: () =>
    new AppError({
      code: "UNAVAILABLE",
      message: "The request could not be completed.",
    }),
  try: () => headers(),
});

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
