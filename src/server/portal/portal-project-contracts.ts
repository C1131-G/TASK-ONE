import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";
import { UUIDSchema } from "../core/input-schemas";
import { ProjectStatusSchema } from "../projects/project-contracts";
import type { PortalActor } from "./portal-contracts";

// The read-only view of a project a client company is shown. Every field is
// listed here on purpose: nothing from staff-side records (comments, people,
// files, descriptions of tasks) has a place in these shapes.
export const PortalSharedMilestoneSchema = Schema.Struct({
  dueDate: Schema.NullOr(Schema.String),
  id: UUIDSchema,
  name: Schema.String,
});

export const PortalSharedTaskSchema = Schema.Struct({
  dueDate: Schema.NullOr(Schema.String),
  id: UUIDSchema,
  status: Schema.Literals(["backlog", "todo", "progress", "review", "done"]),
  title: Schema.String,
});

export const PortalSharedProjectSummarySchema = Schema.Struct({
  description: Schema.NullOr(Schema.String),
  dueDate: Schema.NullOr(Schema.String),
  id: UUIDSchema,
  key: Schema.String,
  name: Schema.String,
  nextMilestone: Schema.NullOr(
    Schema.Struct({
      dueDate: Schema.NullOr(Schema.String),
      name: Schema.String,
    })
  ),
  // Counts only the tasks marked for the client.
  progress: Schema.Struct({ done: Schema.Number, total: Schema.Number }),
  status: ProjectStatusSchema,
});

export const PortalSharedProjectListSchema = Schema.Array(
  PortalSharedProjectSummarySchema
);

export const PortalSharedProjectDetailSchema = Schema.Struct({
  ...PortalSharedProjectSummarySchema.fields,
  milestones: Schema.Array(PortalSharedMilestoneSchema),
  tasks: Schema.Array(PortalSharedTaskSchema),
});

export const PortalSharedProjectInputSchema = Schema.Struct({
  projectId: UUIDSchema,
});

export type PortalSharedProjectSummary =
  typeof PortalSharedProjectSummarySchema.Type;
export type PortalSharedProjectDetail =
  typeof PortalSharedProjectDetailSchema.Type;

export class PortalProjects extends Context.Service<
  PortalProjects,
  {
    readonly listSharedProjects: (
      actor: PortalActor
    ) => Effect.Effect<readonly PortalSharedProjectSummary[], AppError>;
    readonly getSharedProject: (
      actor: PortalActor,
      projectId: string
    ) => Effect.Effect<PortalSharedProjectDetail, AppError>;
  }
>()("metsys/server/PortalProjects") {}
