import type { Effect } from "effect";
import { Context, Schema } from "effect";

import type { AppError } from "../core/action-result";

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
  readonly filters: typeof Schema.Json.Type;
  readonly sort: typeof Schema.Json.Type;
  readonly groupBy: string | null;
  readonly hiddenColumns: typeof Schema.Json.Type;
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
  filters: Schema.Json,
  groupBy: Schema.NullOr(Schema.String),
  hiddenColumns: Schema.Json,
  id: Schema.String,
  isShared: Schema.Boolean,
  name: Schema.String,
  projectId: Schema.NullOr(Schema.String),
  sort: Schema.Json,
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
      input: SavedViewInput
    ) => Effect.Effect<SavedViewSummary, AppError>;
    readonly updateView: (
      userId: string,
      viewId: string,
      input: SavedViewInput
    ) => Effect.Effect<SavedViewSummary, AppError>;
    readonly deleteView: (
      userId: string,
      viewId: string
    ) => Effect.Effect<void, AppError>;
  }
>()("metsys/server/SavedViewManagement") {}
