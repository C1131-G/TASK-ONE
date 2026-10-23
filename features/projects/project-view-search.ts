import type {
  SavedViewFilters,
  SavedViewGroupBy,
  SavedViewSort,
} from "@/src/server/preferences/saved-view-settings";

import type { TaskTableColumnId } from "../tasks/task-table-columns";
import {
  HIDEABLE_COLUMNS,
  parseHiddenColumns,
  serializeHiddenColumns,
} from "../tasks/task-table-columns";

// A project's table is the only one with custom field columns. Whether a
// listed field still exists is checked where its fields are known.
const PROJECT_COLUMN_OPTIONS = { customFields: true } as const;

export const PROJECT_VIEW_STATUSES = [
  "backlog",
  "todo",
  "progress",
  "review",
  "done",
] as const;
export const PROJECT_VIEW_PRIORITIES = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
] as const;
export const PROJECT_VIEW_SORTS = [
  "manual",
  "name",
  "due",
  "priority",
] as const;
export const PROJECT_VIEW_GROUPS = ["status", "none"] as const;

type ProjectViewStatus = (typeof PROJECT_VIEW_STATUSES)[number];
type ProjectViewPriority = (typeof PROJECT_VIEW_PRIORITIES)[number];
type ProjectViewSortField = (typeof PROJECT_VIEW_SORTS)[number];
type ProjectViewGroup = (typeof PROJECT_VIEW_GROUPS)[number];

// The raw form is what the URL and inputs hold; the normalized form is what
// views render and what gets saved. Unknown URL values fall back to defaults.
export interface ProjectViewSearch {
  readonly q: string;
  readonly status: string;
  readonly priority: string;
  readonly sort: string;
  readonly group: string;
  readonly hidden: string;
}

export interface NormalizedProjectViewSearch {
  readonly q: string;
  readonly status: ProjectViewStatus | "all";
  readonly priority: ProjectViewPriority | "all";
  readonly sort: ProjectViewSortField;
  readonly group: ProjectViewGroup;
  readonly hidden: readonly TaskTableColumnId[];
}

export const defaultProjectViewSearch: ProjectViewSearch = {
  group: "status",
  hidden: "",
  priority: "all",
  q: "",
  sort: "manual",
  status: "all",
};

const MAX_QUERY_LENGTH = 200;

const pick = <Value extends string>(
  values: readonly Value[],
  value: string | null | undefined
): Value | undefined => values.find((candidate) => candidate === value);

export const normalizeProjectViewSearch = (
  raw: ProjectViewSearch
): NormalizedProjectViewSearch => ({
  group: pick(PROJECT_VIEW_GROUPS, raw.group) ?? "status",
  hidden: parseHiddenColumns(
    raw.hidden,
    HIDEABLE_COLUMNS,
    PROJECT_COLUMN_OPTIONS
  ),
  priority: pick(PROJECT_VIEW_PRIORITIES, raw.priority) ?? "all",
  q: raw.q.slice(0, MAX_QUERY_LENGTH),
  sort: pick(PROJECT_VIEW_SORTS, raw.sort) ?? "manual",
  status: pick(PROJECT_VIEW_STATUSES, raw.status) ?? "all",
});

// Raw form read from the URL, with defaults filled in but values not validated.
export const readProjectViewSearchRaw = (
  params: URLSearchParams
): ProjectViewSearch => ({
  group: params.get("group") ?? defaultProjectViewSearch.group,
  hidden: params.get("hidden") ?? defaultProjectViewSearch.hidden,
  priority: params.get("priority") ?? defaultProjectViewSearch.priority,
  q: params.get("q") ?? defaultProjectViewSearch.q,
  sort: params.get("sort") ?? defaultProjectViewSearch.sort,
  status: params.get("status") ?? defaultProjectViewSearch.status,
});

export const readProjectViewSearch = (
  params: URLSearchParams
): NormalizedProjectViewSearch =>
  normalizeProjectViewSearch(readProjectViewSearchRaw(params));

// Defaults are omitted from the URL so that a plain project link stays clean.
export const writeProjectViewSearch = (
  params: URLSearchParams,
  search: ProjectViewSearch
): URLSearchParams => {
  const next = new URLSearchParams(params);
  const entries: readonly [string, string, string][] = [
    ["q", search.q, defaultProjectViewSearch.q],
    ["status", search.status, defaultProjectViewSearch.status],
    ["priority", search.priority, defaultProjectViewSearch.priority],
    ["sort", search.sort, defaultProjectViewSearch.sort],
    ["group", search.group, defaultProjectViewSearch.group],
    ["hidden", search.hidden, defaultProjectViewSearch.hidden],
  ];
  for (const [key, value, fallback] of entries) {
    if (value === fallback || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  return next;
};

// Saved views store normalized values; the URL stores the raw form.
export const toRawProjectViewSearch = (
  search: NormalizedProjectViewSearch
): ProjectViewSearch => ({
  group: search.group,
  hidden: serializeHiddenColumns(
    search.hidden,
    HIDEABLE_COLUMNS,
    PROJECT_COLUMN_OPTIONS
  ),
  priority: search.priority,
  q: search.q,
  sort: search.sort,
  status: search.status,
});

export const projectViewSearchToSettings = (
  search: NormalizedProjectViewSearch
): {
  readonly filters: SavedViewFilters;
  readonly sort: SavedViewSort;
  readonly groupBy: SavedViewGroupBy;
  readonly hiddenColumns: readonly TaskTableColumnId[];
} => ({
  filters: {
    priority: search.priority === "all" ? [] : [search.priority],
    query: search.q,
    status: search.status === "all" ? [] : [search.status],
  },
  groupBy: search.group,
  hiddenColumns: search.hidden,
  sort: { direction: "asc", field: search.sort },
});

export const projectViewSettingsToSearch = (settings: {
  readonly filters: SavedViewFilters;
  readonly sort: SavedViewSort;
  readonly groupBy: SavedViewGroupBy;
  readonly hiddenColumns: readonly string[];
}): NormalizedProjectViewSearch => ({
  group: settings.groupBy ?? "status",
  hidden: parseHiddenColumns(
    serializeHiddenColumns(
      settings.hiddenColumns,
      HIDEABLE_COLUMNS,
      PROJECT_COLUMN_OPTIONS
    ),
    HIDEABLE_COLUMNS,
    PROJECT_COLUMN_OPTIONS
  ),
  priority: settings.filters.priority[0] ?? "all",
  q: settings.filters.query,
  sort: settings.sort.field,
  status: settings.filters.status[0] ?? "all",
});

export const projectViewHref = (
  projectId: string,
  viewId: string,
  search: NormalizedProjectViewSearch
): `/projects/${string}?${string}` => {
  const params = writeProjectViewSearch(
    new URLSearchParams({ view: `saved-${viewId}` }),
    toRawProjectViewSearch(search)
  );
  return `/projects/${projectId}?${params.toString()}`;
};

export const isSameProjectViewSearch = (
  first: ProjectViewSearch,
  second: ProjectViewSearch
): boolean =>
  first.group === second.group &&
  first.priority === second.priority &&
  first.q === second.q &&
  first.sort === second.sort &&
  first.status === second.status &&
  first.hidden === second.hidden;

export const isSameNormalizedProjectViewSearch = (
  first: NormalizedProjectViewSearch,
  second: NormalizedProjectViewSearch
): boolean =>
  isSameProjectViewSearch(
    toRawProjectViewSearch(first),
    toRawProjectViewSearch(second)
  );
