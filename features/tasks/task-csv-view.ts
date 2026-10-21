import {
  GLOBAL_TASK_PRIORITIES,
  GLOBAL_TASK_STATUSES,
} from "@/features/tasks/types/global-task-view-contracts";
import type { ImportRowError } from "@/src/server/tasks/csv";
import type { TaskCsvFilters } from "@/src/server/tasks/task-csv";

// Client-side helpers for the task CSV export and import controls.

const MAX_LISTED_ERRORS = 20;

interface ExportSearch {
  readonly overdue: boolean;
  readonly priority: string;
  readonly q: string;
  readonly status: string;
}

// The page's own filters become the export's filters; defaults are left out.
export const exportFiltersFromSearch = (
  search: ExportSearch,
  projectId?: string
): TaskCsvFilters => {
  const filters: {
    -readonly [Key in keyof TaskCsvFilters]: TaskCsvFilters[Key];
  } = {};
  if (projectId) {
    filters.projectId = projectId;
  }
  const status = GLOBAL_TASK_STATUSES.find(
    (candidate) => candidate === search.status
  );
  if (status) {
    filters.status = status;
  }
  const priority = GLOBAL_TASK_PRIORITIES.find(
    (candidate) => candidate === search.priority
  );
  if (priority) {
    filters.priority = priority;
  }
  if (search.overdue) {
    filters.overdue = true;
  }
  if (search.q) {
    filters.q = search.q;
  }
  return filters;
};

export const csvDownloadName = (today: string): string => `tasks-${today}.csv`;

export const describeImportErrors = (
  errors: readonly ImportRowError[]
): string[] => {
  const lines = errors
    .slice(0, MAX_LISTED_ERRORS)
    .map(({ column, line, message }) =>
      column === null ? message : `Row ${line}, ${column}: ${message}`
    );
  const hidden = errors.length - MAX_LISTED_ERRORS;
  return hidden > 0
    ? [
        ...lines,
        `…and ${hidden} more ${hidden === 1 ? "problem" : "problems"}.`,
      ]
    : lines;
};
