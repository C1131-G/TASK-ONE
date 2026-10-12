import { Schema } from "effect";

import type { CodecTypes } from "@/src/prisma/contract.d";

import { AppError } from "../core/action-result";
import type { SavedViewInput, SavedViewType } from "./saved-view-contracts";
import {
  SavedViewFiltersSchema,
  SavedViewGroupBySchema,
  SavedViewHiddenColumnsSchema,
  SavedViewSortSchema,
} from "./saved-view-settings";

type JsonInput = CodecTypes["pg/jsonb@1"]["input"];

export const SavedViewInputSchema = Schema.Struct({
  filters: SavedViewFiltersSchema,
  groupBy: SavedViewGroupBySchema,
  hiddenColumns: SavedViewHiddenColumnsSchema,
  isShared: Schema.Boolean,
  name: Schema.String,
  projectId: Schema.NullOr(Schema.String.check(Schema.isUUID())),
  sort: SavedViewSortSchema,
  type: Schema.Literals(["board", "list", "table", "calendar", "timeline"]),
});

export const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The saved view could not be updated.",
      });

export const validateInput = (
  input: SavedViewInput
): {
  readonly name: string;
  readonly projectId: string | null;
  readonly groupBy: string | null;
  readonly filters: JsonInput;
  readonly sort: JsonInput;
  readonly hiddenColumns: JsonInput;
  readonly type: SavedViewType;
  readonly isShared: boolean;
} => {
  let decoded: typeof SavedViewInputSchema.Type;
  try {
    decoded = Schema.decodeUnknownSync(SavedViewInputSchema)(input);
  } catch {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "The saved view settings are invalid.",
    });
  }
  const name = decoded.name.trim();
  if (!name || name.length > 80) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "View names must be 1 to 80 characters.",
    });
  }

  return {
    filters: decoded.filters,
    groupBy: decoded.groupBy,
    hiddenColumns: decoded.hiddenColumns,
    isShared: decoded.isShared,
    name,
    projectId: decoded.projectId,
    sort: decoded.sort,
    type: decoded.type,
  };
};
