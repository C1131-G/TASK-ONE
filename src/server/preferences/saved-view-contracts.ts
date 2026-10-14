import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";
import {
  SavedViewFiltersSchema,
  SavedViewGroupBySchema,
  SavedViewHiddenColumnsSchema,
  SavedViewSortSchema,
} from "./saved-view-settings";
import type {
  SavedViewFilters,
  SavedViewGroupBy,
  SavedViewSort,
} from "./saved-view-settings";

export type SavedViewType =
  | "board"
  | "list"
  | "table"
  | "calendar"
  | "timeline";

export const SavedViewTypeSchema = Schema.Literals([
  "board",
  "list",
  "table",
  "calendar",
  "timeline",
]);

export interface SavedViewInput {
  readonly name: string;
  readonly type: SavedViewType;
  readonly projectId: string | null;
  readonly filters: SavedViewFilters;
  readonly sort: SavedViewSort;
  readonly groupBy: SavedViewGroupBy;
  readonly hiddenColumns: readonly string[];
  readonly isShared: boolean;
}

export interface SavedViewSummary extends SavedViewInput {
  readonly id: string;
  readonly userId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const SavedViewSummarySchema = Schema.Struct({
  createdAt: Schema.String,
  filters: SavedViewFiltersSchema,
  groupBy: SavedViewGroupBySchema,
  hiddenColumns: SavedViewHiddenColumnsSchema,
  id: Schema.String,
  isShared: Schema.Boolean,
  name: Schema.String,
  projectId: Schema.NullOr(Schema.String),
  sort: SavedViewSortSchema,
  type: SavedViewTypeSchema,
  updatedAt: Schema.String,
  userId: Schema.String,
});
export class SavedViewManagement extends Context.Service<
  SavedViewManagement,
  {
    readonly listViews: (
      userId: string
    ) => Effect.Effect<readonly SavedViewSummary[], AppError>;
    readonly createView: (
      userId: string,
      input: unknown
    ) => Effect.Effect<SavedViewSummary, AppError>;
    readonly updateView: (
      userId: string,
      viewId: string,
      input: unknown
    ) => Effect.Effect<SavedViewSummary, AppError>;
    readonly deleteView: (
      userId: string,
      viewId: string
    ) => Effect.Effect<void, AppError>;
  }
>()("metsys/server/SavedViewManagement") {}
