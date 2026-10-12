import type {
  SavedViewFilters,
  SavedViewGroupBy,
  SavedViewSort,
} from "../../src/server/preferences/saved-view-settings";

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
}

export interface NormalizedProjectViewSearch {
  readonly q: string;
  readonly status: ProjectViewStatus | "all";
  readonly priority: ProjectViewPriority | "all";
  readonly sort: ProjectViewSortField;
  readonly group: ProjectViewGroup;
}

export const defaultProjectViewSearch: ProjectViewSearch = {
  group: "status",
  priority: "all",
  q: "",
  sort: "manual",
  status: "all",
};

const MAX_QUERY_LENGTH = 200;

const pick = <Value extends string>(
  values: readonly Value[],
  value: string | null | undefined
): Value | undefined => values.find((item) => item === value);

export const normalizeProjectViewSearch = (
  raw: ProjectViewSearch
): NormalizedProjectViewSearch => ({
  group: pick(PROJECT_VIEW_GROUPS, raw.group) ?? "status",
  priority: pick(PROJECT_VIEW_PRIORITIES, raw.priority) ?? "all",
  q: raw.q.slice(0, MAX_QUERY_LENGTH),
  sort: pick(PROJECT_VIEW_SORTS, raw.sort) ?? "manual",
  status: pick(PROJECT_VIEW_STATUSES, raw.status) ?? "all",
});

export const readProjectViewSearch = (
  params: URLSearchParams
): NormalizedProjectViewSearch =>
  normalizeProjectViewSearch({
    group: params.get("group") ?? defaultProjectViewSearch.group,
    priority: params.get("priority") ?? defaultProjectViewSearch.priority,
    q: params.get("q") ?? defaultProjectViewSearch.q,
    sort: params.get("sort") ?? defaultProjectViewSearch.sort,
    status: params.get("status") ?? defaultProjectViewSearch.status,
  });

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

export const projectViewSearchToSettings = (
  search: ProjectViewSearch
): {
  readonly filters: SavedViewFilters;
  readonly sort: SavedViewSort;
  readonly groupBy: SavedViewGroupBy;
} => {
  const normalized = normalizeProjectViewSearch(search);
  return {
    filters: {
      priority: normalized.priority === "all" ? [] : [normalized.priority],
      query: normalized.q,
      status: normalized.status === "all" ? [] : [normalized.status],
    },
    groupBy: normalized.group,
    sort: { direction: "asc", field: normalized.sort },
  };
};

export const projectViewSettingsToSearch = (settings: {
  readonly filters: SavedViewFilters;
  readonly sort: SavedViewSort;
  readonly groupBy: SavedViewGroupBy;
}): ProjectViewSearch => ({
  group: settings.groupBy ?? defaultProjectViewSearch.group,
  priority: settings.filters.priority[0] ?? defaultProjectViewSearch.priority,
  q: settings.filters.query,
  sort: settings.sort.field,
  status: settings.filters.status[0] ?? defaultProjectViewSearch.status,
});

export const projectViewHref = (
  projectId: string,
  viewId: string,
  search: ProjectViewSearch
): string => {
  const params = writeProjectViewSearch(
    new URLSearchParams({ view: `saved-${viewId}` }),
    search
  );
  return `/projects/${projectId}?${params.toString()}`;
};
