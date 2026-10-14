// View state for the workspace task pages (/tasks and /my-tasks). The URL, the
// store and the server page all read the same vocabulary from here, so a saved
// link, a tab or a month navigation keeps every filter the user set.
import type { TaskTableColumnId } from "./task-table-columns";
import {
  GLOBAL_HIDEABLE_COLUMNS,
  parseHiddenColumns,
  serializeHiddenColumns,
} from "./task-table-columns";
import {
  CALENDAR_MODES,
  GLOBAL_TASK_GROUPS,
  GLOBAL_TASK_PRIORITIES,
  GLOBAL_TASK_SORTS,
  GLOBAL_TASK_STATUSES,
} from "./types/global-task-view-contracts";
import type {
  GlobalTaskSearch,
  NormalizedGlobalTaskSearch,
} from "./types/global-task-view-contracts";

export {
  CALENDAR_MODES,
  GLOBAL_TASK_GROUPS,
  GLOBAL_TASK_PRIORITIES,
  GLOBAL_TASK_SORTS,
  GLOBAL_TASK_STATUSES,
  GLOBAL_TASK_VIEWS,
  MY_TASK_VIEWS,
} from "./types/global-task-view-contracts";
export type {
  GlobalTaskGroup,
  GlobalTaskLike,
  GlobalTaskSearch,
  GlobalTaskSort,
  NormalizedGlobalTaskSearch,
} from "./types/global-task-view-contracts";

const MAX_QUERY_LENGTH = 200;
const MAX_MONTH_OFFSET = 24;

// Defaults are omitted from the URL so a plain /tasks link stays clean.
export const defaultGlobalTaskSearch: GlobalTaskSearch = {
  calendarMode: "month",
  group: "status",
  hidden: "",
  monthOffset: "0",
  overdue: "",
  priority: "all",
  q: "",
  sort: "due",
  status: "all",
  view: "list",
};

const pick = <Value extends string>(
  values: readonly Value[],
  value: string | null | undefined
): Value | undefined => values.find((candidate) => candidate === value);

// Older links used "name" for the title sort; it maps to the same field.
const SORT_ALIASES: Readonly<Record<string, string>> = { name: "title" };

export const readGlobalTaskSearchRaw = (
  params: URLSearchParams
): GlobalTaskSearch => {
  const sortParam = params.get("sort");
  return {
    calendarMode:
      params.get("calendarMode") ?? defaultGlobalTaskSearch.calendarMode,
    group: params.get("group") ?? defaultGlobalTaskSearch.group,
    hidden: params.get("hidden") ?? defaultGlobalTaskSearch.hidden,
    monthOffset:
      params.get("monthOffset") ?? defaultGlobalTaskSearch.monthOffset,
    overdue: params.get("overdue") ?? defaultGlobalTaskSearch.overdue,
    priority: params.get("priority") ?? defaultGlobalTaskSearch.priority,
    q: params.get("q") ?? defaultGlobalTaskSearch.q,
    sort:
      SORT_ALIASES[sortParam ?? ""] ??
      sortParam ??
      defaultGlobalTaskSearch.sort,
    status: params.get("status") ?? defaultGlobalTaskSearch.status,
    view: params.get("view") ?? defaultGlobalTaskSearch.view,
  };
};

const isGlobalTaskSearchKey = (key: string): key is keyof GlobalTaskSearch =>
  Object.hasOwn(defaultGlobalTaskSearch, key);

// Keeps unrelated params (for example a saved view or a deep link) and writes
// the search fields, dropping any field that is at its default.
export const writeGlobalTaskSearch = (
  params: URLSearchParams,
  search: GlobalTaskSearch
): URLSearchParams => {
  const next = new URLSearchParams(params);
  for (const key of Object.keys(defaultGlobalTaskSearch).filter(
    isGlobalTaskSearchKey
  )) {
    const value = search[key];
    if (value === defaultGlobalTaskSearch[key] || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  return next;
};

export const globalTaskQuery = (
  search: GlobalTaskSearch,
  patch: Partial<GlobalTaskSearch> = {}
): string =>
  writeGlobalTaskSearch(new URLSearchParams(), {
    ...search,
    ...patch,
  }).toString();

export const globalTaskHref = <Pathname extends string>(
  pathname: Pathname,
  search: GlobalTaskSearch,
  patch: Partial<GlobalTaskSearch> = {}
): Pathname | `${Pathname}?${string}` => {
  const query = globalTaskQuery(search, patch);
  return query ? `${pathname}?${query}` : pathname;
};

export const isSameGlobalTaskSearch = (
  first: GlobalTaskSearch,
  second: GlobalTaskSearch
): boolean =>
  writeGlobalTaskSearch(new URLSearchParams(), first).toString() ===
  writeGlobalTaskSearch(new URLSearchParams(), second).toString();

export const normalizeGlobalTaskSearch = (
  raw: GlobalTaskSearch,
  views: readonly string[]
): NormalizedGlobalTaskSearch => {
  const offset = Number(raw.monthOffset);
  return {
    calendarMode: pick(CALENDAR_MODES, raw.calendarMode) ?? "month",
    group: pick(GLOBAL_TASK_GROUPS, raw.group) ?? "status",
    hidden: parseHiddenColumns(raw.hidden, GLOBAL_HIDEABLE_COLUMNS),
    monthOffset: Number.isInteger(offset)
      ? Math.max(-MAX_MONTH_OFFSET, Math.min(MAX_MONTH_OFFSET, offset))
      : 0,
    overdue: raw.overdue === "true",
    priority: pick(GLOBAL_TASK_PRIORITIES, raw.priority) ?? "all",
    q: raw.q.trim().toLocaleLowerCase().slice(0, MAX_QUERY_LENGTH),
    sort: pick(GLOBAL_TASK_SORTS, raw.sort) ?? "due",
    status: pick(GLOBAL_TASK_STATUSES, raw.status) ?? "all",
    view: pick(views, raw.view) ?? views[0] ?? "list",
  };
};

export const serializeGlobalTaskHidden = (
  ids: readonly TaskTableColumnId[]
): string => serializeHiddenColumns(ids, GLOBAL_HIDEABLE_COLUMNS);

export {
  filterGlobalTasks,
  groupGlobalTasks,
  groupTasksByDueDate,
  sortGlobalTasks,
} from "./global-task-grouping";
export type { DueGroup, GlobalTaskGroupOf } from "./global-task-grouping";
