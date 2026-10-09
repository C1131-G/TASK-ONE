import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";
import { CalendarDateSchema, ProjectKeySchema } from "../core/input-schemas";

export const DuplicateProjectInputSchema = Schema.Struct({
  key: ProjectKeySchema,
  name: Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(120)),
});
export type DuplicateProjectInput = typeof DuplicateProjectInputSchema.Type;

export const CreateProjectInputSchema = Schema.Struct({
  color: Schema.optional(Schema.String.check(Schema.isMaxLength(40))),
  description: Schema.NullOr(Schema.String),
  dueDate: Schema.optional(Schema.NullOr(CalendarDateSchema)),
  icon: Schema.optional(Schema.String.check(Schema.isMaxLength(40))),
  key: ProjectKeySchema,
  name: Schema.String,
  startDate: Schema.optional(Schema.NullOr(CalendarDateSchema)),
  status: Schema.Literals(["planning", "active", "risk", "hold", "complete"]),
  teamId: Schema.optional(Schema.NullOr(Schema.String.check(Schema.isUUID()))),
  templateId: Schema.optional(
    Schema.Literals([
      "blank",
      "product",
      "web",
      "mkt",
      "design",
      "software",
      "personal",
    ])
  ),
});
export type CreateProjectInput = typeof CreateProjectInputSchema.Type;
export const UpdateProjectInputSchema = Schema.Struct({
  color: Schema.optional(Schema.String.check(Schema.isMaxLength(40))),
  description: Schema.NullOr(Schema.String),
  dueDate: Schema.optional(Schema.NullOr(CalendarDateSchema)),
  icon: Schema.optional(Schema.String.check(Schema.isMaxLength(40))),
  name: Schema.String,
  position: Schema.optional(
    Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))
  ),
  startDate: Schema.optional(Schema.NullOr(CalendarDateSchema)),
  status: Schema.Literals(["planning", "active", "risk", "hold", "complete"]),
  teamId: Schema.optional(Schema.NullOr(Schema.String.check(Schema.isUUID()))),
});
export type UpdateProjectInput = typeof UpdateProjectInputSchema.Type;

export const ProjectStatusSchema = Schema.Literals([
  "planning",
  "active",
  "risk",
  "hold",
  "complete",
]);

export const ProjectSummarySchema = Schema.Struct({
  archivedAt: Schema.NullOr(Schema.String),
  color: Schema.String,
  description: Schema.NullOr(Schema.String),
  dueDate: Schema.NullOr(Schema.String),
  icon: Schema.String,
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
  position: Schema.Number,
  startDate: Schema.NullOr(Schema.String),
  status: ProjectStatusSchema,
  teamId: Schema.NullOr(Schema.String),
  version: Schema.Number,
});

export const ProjectWithPeopleSchema = Schema.Struct({
  ...ProjectSummarySchema.fields,
  leadId: Schema.NullOr(Schema.String),
  memberIds: Schema.Array(Schema.String),
});

export const ProjectListItemSchema = Schema.Struct({
  ...ProjectWithPeopleSchema.fields,
  completedTaskCount: Schema.Number,
  progress: Schema.Number,
  taskCount: Schema.Number,
});

export const ProjectMilestonesResultSchema = Schema.Struct({
  milestones: Schema.Array(
    Schema.Struct({
      completed: Schema.Boolean,
      dueDate: Schema.NullOr(Schema.String),
      id: Schema.String,
      name: Schema.String,
      position: Schema.Number,
    })
  ),
  projectId: Schema.String,
  version: Schema.Number,
});

export interface ProjectSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: CreateProjectInput["status"];
  readonly version: number;
  readonly archivedAt: string | null;
  readonly color: string;
  readonly dueDate: string | null;
  readonly icon: string;
  readonly position: number;
  readonly startDate: string | null;
  readonly teamId: string | null;
}
export interface ProjectWithPeople extends ProjectSummary {
  readonly leadId: string | null;
  readonly memberIds: readonly string[];
}
export interface ProjectListItem extends ProjectWithPeople {
  readonly taskCount: number;
  readonly completedTaskCount: number;
  readonly progress: number;
}
export interface SetProjectPeopleInput {
  readonly leadId: string | null;
  readonly memberIds: readonly string[];
}
export const SaveProjectMilestonesInputSchema = Schema.Struct({
  expectedVersion: Schema.Number,
  milestones: Schema.Array(
    Schema.Struct({
      completed: Schema.Boolean,
      dueDate: Schema.NullOr(CalendarDateSchema),
      id: Schema.NullOr(Schema.String.check(Schema.isUUID())),
      name: Schema.String,
    })
  ),
  projectId: Schema.String.check(Schema.isUUID()),
});
export interface ProjectMilestoneInput {
  readonly id: string | null;
  readonly name: string;
  readonly dueDate: string | null;
  readonly completed: boolean;
}
export interface ProjectMilestone {
  readonly id: string;
  readonly name: string;
  readonly dueDate: string | null;
  readonly completed: boolean;
  readonly position: number;
}
export interface ProjectMilestonesResult {
  readonly projectId: string;
  readonly version: number;
  readonly milestones: readonly ProjectMilestone[];
}

export class ProjectManagement extends Context.Service<
  ProjectManagement,
  {
    readonly createProject: (
      actorId: string,
      input: CreateProjectInput
    ) => Effect.Effect<ProjectSummary, AppError>;
    readonly duplicateProject: (
      actorId: string,
      sourceProjectId: string,
      input: DuplicateProjectInput
    ) => Effect.Effect<ProjectSummary, AppError>;
    readonly updateProject: (
      actorId: string,
      projectId: string,
      expectedVersion: number,
      input: UpdateProjectInput
    ) => Effect.Effect<ProjectSummary, AppError>;
    readonly archiveProject: (
      actorId: string,
      projectId: string,
      expectedVersion: number
    ) => Effect.Effect<ProjectSummary, AppError>;
    readonly restoreProject: (
      actorId: string,
      projectId: string,
      expectedVersion: number
    ) => Effect.Effect<ProjectSummary, AppError>;
    readonly setProjectPeople: (
      actorId: string,
      projectId: string,
      expectedVersion: number,
      input: SetProjectPeopleInput
    ) => Effect.Effect<ProjectWithPeople, AppError>;
    readonly listProjects: (
      requesterId: string,
      options?: { readonly includeArchived?: boolean }
    ) => Effect.Effect<readonly ProjectListItem[], AppError>;
    readonly saveProjectMilestones: (
      actorId: string,
      projectId: string,
      expectedVersion: number,
      milestones: readonly ProjectMilestoneInput[]
    ) => Effect.Effect<ProjectMilestonesResult, AppError>;
    readonly listProjectMilestones: (
      requesterId: string,
      projectId: string
    ) => Effect.Effect<ProjectMilestonesResult, AppError>;
  }
>()("metsys/server/ProjectManagement") {}
