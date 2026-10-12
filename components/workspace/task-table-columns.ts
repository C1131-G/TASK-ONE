// One registry for the project task table. Column order, labels, sort fields and
// width bounds live here so the table, the visibility menu, saved views and the
// URL all agree on the same column IDs.
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
export type TaskTableColumnId = TaskTableColumn["id"];

const MAX_COLUMN_WIDTH = 800;

export const HIDEABLE_COLUMNS: readonly TaskTableColumn[] =
  TASK_TABLE_COLUMNS.filter((column) => column.hideable);

const HIDEABLE_IDS: ReadonlySet<string> = new Set(
  HIDEABLE_COLUMNS.map((column) => column.id)
);

export const parseHiddenColumns = (
  value: string | null | undefined
): readonly TaskTableColumnId[] => {
  if (!value) {
    return [];
  }
  const requested = new Set(value.split(","));
  const ids: TaskTableColumnId[] = [];
  for (const column of HIDEABLE_COLUMNS) {
    if (requested.has(column.id)) {
      ids.push(column.id);
    }
  }
  return ids;
};

export const serializeHiddenColumns = (ids: readonly string[]): string => {
  const selected = new Set(ids);
  const ordered: string[] = [];
  for (const column of HIDEABLE_COLUMNS) {
    if (HIDEABLE_IDS.has(column.id) && selected.has(column.id)) {
      ordered.push(column.id);
    }
  }
  return ordered.join(",");
};

export const clampColumnWidth = (
  id: TaskTableColumnId,
  width: number
): number => {
  const column = TASK_TABLE_COLUMNS.find((item) => item.id === id);
  const minimum = column?.minWidth ?? 80;
  return Math.min(MAX_COLUMN_WIDTH, Math.max(minimum, Math.round(width)));
};

export const defaultColumnWidth = (id: TaskTableColumnId): number =>
  TASK_TABLE_COLUMNS.find((column) => column.id === id)?.defaultWidth ?? 120;
