import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";
import { TaskPrioritySchema, TaskStatusSchema } from "../work/work-contracts";

export interface PersonalWorkspace {
  readonly projects: readonly { readonly id: string; readonly name: string }[];
  readonly tasks: readonly {
    readonly assignees: readonly {
      readonly id: string;
      readonly name: string;
    }[];
    readonly completedAt: string | null;
    readonly createdById: string;
    readonly dueDate: string | null;
    readonly id: string;
    readonly priority: typeof TaskPrioritySchema.Type;
    readonly projectId: string;
    readonly projectName: string;
    readonly projectTaskNumber: number;
    readonly startDate: string | null;
    readonly status: typeof TaskStatusSchema.Type;
    readonly title: string;
    readonly version: number;
  }[];
  readonly recentSearches: readonly string[];
}

export interface WorkspaceSearchResults {
  readonly projects: readonly { readonly id: string; readonly name: string }[];
  readonly tasks: readonly {
    readonly id: string;
    readonly title: string;
    readonly projectId: string;
    readonly projectName: string;
  }[];
}

export const PersonalWorkspaceSchema = Schema.Struct({
  projects: Schema.Array(
    Schema.Struct({ id: Schema.String, name: Schema.String })
  ),
  recentSearches: Schema.Array(Schema.String),
  tasks: Schema.Array(
    Schema.Struct({
      assignees: Schema.Array(
        Schema.Struct({ id: Schema.String, name: Schema.String })
      ),
      completedAt: Schema.NullOr(Schema.String),
      createdById: Schema.String,
      dueDate: Schema.NullOr(Schema.String),
      id: Schema.String,
      priority: TaskPrioritySchema,
      projectId: Schema.String,
      projectName: Schema.String,
      projectTaskNumber: Schema.Number,
      startDate: Schema.NullOr(Schema.String),
      status: TaskStatusSchema,
      title: Schema.String,
      version: Schema.Number,
    })
  ),
});

export const WorkspaceSearchResultsSchema = Schema.Struct({
  projects: Schema.Array(
    Schema.Struct({ id: Schema.String, name: Schema.String })
  ),
  tasks: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      projectId: Schema.String,
      projectName: Schema.String,
      title: Schema.String,
    })
  ),
});

export class DiscoveryManagement extends Context.Service<
  DiscoveryManagement,
  {
    readonly toggleProjectFavorite: (
      userId: string,
      projectId: string
    ) => Effect.Effect<boolean, AppError>;
    readonly toggleTaskFavorite: (
      userId: string,
      taskId: string
    ) => Effect.Effect<boolean, AppError>;
    readonly addRecentSearch: (
      userId: string,
      query: string
    ) => Effect.Effect<readonly string[], AppError>;
    readonly listPersonalWorkspace: (
      userId: string
    ) => Effect.Effect<PersonalWorkspace, AppError>;
    readonly searchWorkspace: (
      userId: string,
      query: string
    ) => Effect.Effect<WorkspaceSearchResults, AppError>;
  }
>()("taskora/server/DiscoveryManagement") {}
