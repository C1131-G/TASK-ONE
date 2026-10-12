import { Schema } from "effect";

import { TaskPrioritySchema, TaskStatusSchema } from "../work/work-contracts";

export const SavedViewSortSchema = Schema.Struct({
  direction: Schema.Literals(["asc", "desc"]),
  field: Schema.Literals(["manual", "name", "due", "priority"]),
});

export const SavedViewFiltersSchema = Schema.Struct({
  priority: Schema.Array(TaskPrioritySchema).check(Schema.isMaxLength(5)),
  query: Schema.String.check(Schema.isMaxLength(200)),
  status: Schema.Array(TaskStatusSchema).check(Schema.isMaxLength(5)),
});

export const SavedViewGroupBySchema = Schema.NullOr(
  Schema.Literals(["none", "status"])
);

export const SavedViewHiddenColumnsSchema = Schema.Array(
  Schema.String.check(Schema.isMaxLength(40))
).check(Schema.isMaxLength(30));

export type SavedViewSort = typeof SavedViewSortSchema.Type;
export type SavedViewFilters = typeof SavedViewFiltersSchema.Type;
export type SavedViewGroupBy = typeof SavedViewGroupBySchema.Type;

export const defaultSavedViewSort: SavedViewSort = {
  direction: "asc",
  field: "manual",
};

export const defaultSavedViewFilters: SavedViewFilters = {
  priority: [],
  query: "",
  status: [],
};

// Rows written before typed settings existed stored `{}` or `[]`. Those decode
// to the defaults so they still open; any other malformed value is an error.
const decodeOrDefault = <Value>(
  decode: () => Value,
  fallback: Value,
  stored: unknown
): Value => {
  if (
    stored === null ||
    stored === undefined ||
    (typeof stored === "object" &&
      !Array.isArray(stored) &&
      Object.keys(stored).length === 0) ||
    (Array.isArray(stored) && stored.length === 0)
  ) {
    return fallback;
  }
  return decode();
};

export const decodeSavedViewFilters = (stored: unknown): SavedViewFilters =>
  decodeOrDefault(
    () => Schema.decodeUnknownSync(SavedViewFiltersSchema)(stored),
    defaultSavedViewFilters,
    stored
  );

export const decodeSavedViewSort = (stored: unknown): SavedViewSort =>
  decodeOrDefault(
    () => Schema.decodeUnknownSync(SavedViewSortSchema)(stored),
    defaultSavedViewSort,
    stored
  );

export const decodeSavedViewHiddenColumns = (stored: unknown): string[] =>
  decodeOrDefault(
    () => [...Schema.decodeUnknownSync(SavedViewHiddenColumnsSchema)(stored)],
    [],
    stored
  );
