// Column registries for the task tables. Column order, labels, sort fields and
// width bounds live here so the tables, the visibility menus, saved views, the
// URL and personal width preferences all agree on the same column IDs.
export const TASK_TABLE_COLUMNS = [
  {
    defaultWidth: 320,
    hideable: false,
    id: "task",
    label: "Task",
    minWidth: 180,
    sortField: "name",
  },
  {
    defaultWidth: 150,
    hideable: true,
    id: "status",
    label: "Status",
    minWidth: 110,
    sortField: null,
  },
  {
    defaultWidth: 110,
    hideable: true,
    id: "priority",
    label: "Priority",
    minWidth: 90,
    sortField: "priority",
  },
  {
    defaultWidth: 180,
    hideable: true,
    id: "assignees",
    label: "Assignees",
    minWidth: 120,
    sortField: null,
  },
  {
    defaultWidth: 120,
    hideable: true,
    id: "start",
    label: "Start",
    minWidth: 100,
    sortField: null,
  },
  {
    defaultWidth: 120,
    hideable: true,
    id: "due",
    label: "Due",
    minWidth: 100,
    sortField: "due",
  },
  {
    defaultWidth: 100,
    hideable: true,
    id: "estimate",
    label: "Estimate",
    minWidth: 80,
    sortField: null,
  },
  {
    defaultWidth: 200,
    hideable: true,
    id: "labels",
    label: "Labels",
    minWidth: 120,
    sortField: null,
  },
  {
    defaultWidth: 130,
    hideable: true,
    id: "dependencies",
    label: "Dependencies",
    minWidth: 110,
    sortField: null,
  },
  {
    defaultWidth: 110,
    hideable: false,
    id: "actions",
    label: "Actions",
    minWidth: 100,
    sortField: null,
  },
] as const;

export type TaskTableColumn = (typeof TASK_TABLE_COLUMNS)[number];

// The workspace-wide task tables also show the owning project.
const PROJECT_COLUMN = {
  defaultWidth: 160,
  hideable: true,
  id: "project",
  label: "Project",
  minWidth: 120,
  sortField: null,
} as const;

export type TaskTableColumnId =
  | TaskTableColumn["id"]
  | typeof PROJECT_COLUMN.id;

export interface TaskTableColumnDef {
  readonly defaultWidth: number;
  readonly hideable: boolean;
  readonly id: TaskTableColumnId;
  readonly label: string;
  readonly minWidth: number;
  // Each table sorts by its own field names, so the definition carries the field.
  readonly sortField: string | null;
}

// Workspace task tables (/tasks and /my-tasks) sort on title, priority and due.
export const GLOBAL_TASK_COLUMNS = [
  { ...TASK_TABLE_COLUMNS[0], sortField: "title" },
  TASK_TABLE_COLUMNS[1],
  TASK_TABLE_COLUMNS[3],
  TASK_TABLE_COLUMNS[2],
  TASK_TABLE_COLUMNS[5],
  PROJECT_COLUMN,
  TASK_TABLE_COLUMNS[9],
] as const satisfies readonly TaskTableColumnDef[];

const MAX_COLUMN_WIDTH = 800;

export const HIDEABLE_COLUMNS: readonly TaskTableColumnDef[] =
  TASK_TABLE_COLUMNS.filter((column) => column.hideable);

export const GLOBAL_HIDEABLE_COLUMNS: readonly TaskTableColumnDef[] =
  GLOBAL_TASK_COLUMNS.filter((column) => column.hideable);

const findColumn = (id: TaskTableColumnId): TaskTableColumnDef | undefined =>
  [...TASK_TABLE_COLUMNS, PROJECT_COLUMN].find((column) => column.id === id);

export const parseHiddenColumns = (
  value: string | null | undefined,
  columns: readonly TaskTableColumnDef[] = HIDEABLE_COLUMNS
): readonly TaskTableColumnId[] => {
  if (!value) {
    return [];
  }
  const requested = new Set(value.split(","));
  const ids: TaskTableColumnId[] = [];
  for (const column of columns) {
    if (column.hideable && requested.has(column.id)) {
      ids.push(column.id);
    }
  }
  return ids;
};

export const serializeHiddenColumns = (
  ids: readonly string[],
  columns: readonly TaskTableColumnDef[] = HIDEABLE_COLUMNS
): string => {
  const selected = new Set(ids);
  const ordered: string[] = [];
  for (const column of columns) {
    if (column.hideable && selected.has(column.id)) {
      ordered.push(column.id);
    }
  }
  return ordered.join(",");
};

export const clampColumnWidth = (
  id: TaskTableColumnId,
  width: number
): number => {
  const minimum = findColumn(id)?.minWidth ?? 80;
  return Math.min(MAX_COLUMN_WIDTH, Math.max(minimum, Math.round(width)));
};

export const defaultColumnWidth = (id: TaskTableColumnId): number =>
  findColumn(id)?.defaultWidth ?? 120;

// Stored widths can name columns from an older layout, so only known IDs are kept.
export const columnWidthsFromPreferences = (
  widths?: Readonly<Record<string, number>>
): Partial<Record<TaskTableColumnId, number>> => {
  const result: Partial<Record<TaskTableColumnId, number>> = {};
  for (const column of [...TASK_TABLE_COLUMNS, PROJECT_COLUMN]) {
    const width = widths?.[column.id];
    if (width !== undefined) {
      result[column.id] = clampColumnWidth(column.id, width);
    }
  }
  return result;
};
