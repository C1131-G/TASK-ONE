import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";

export interface PersonalWorkspace {
  readonly projects: readonly { readonly id: string; readonly name: string }[];
  readonly tasks: readonly {
    readonly id: string;
    readonly title: string;
    readonly projectId: string;
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
      id: Schema.String,
      projectId: Schema.String,
      title: Schema.String,
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
>()("metsys/server/DiscoveryManagement") {}
