import { MAX_FIELDS_PER_PROJECT } from "@/src/server/custom-fields/custom-field-definition";

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

// A project's custom fields can be shown as extra columns, named cf:<fieldId>.
// Everything that reads a column id from outside the app (URL, saved views,
// width preferences) goes through parseCustomFieldColumnId.
export type CustomFieldColumnId = `cf:${string}`;

export type TaskTableColumnId =
  | TaskTableColumn["id"]
  | typeof PROJECT_COLUMN.id
  | CustomFieldColumnId;

const CUSTOM_FIELD_COLUMN_PREFIX = "cf:";
const FIELD_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export const customFieldColumnId = (fieldId: string): CustomFieldColumnId =>
  `${CUSTOM_FIELD_COLUMN_PREFIX}${fieldId}`;

// Returns the field id of a canonical cf:<uuid> column id, otherwise nothing.
export const parseCustomFieldColumnId = (id: string): string | undefined => {
  if (!id.startsWith(CUSTOM_FIELD_COLUMN_PREFIX)) {
    return undefined;
  }
  const fieldId = id.slice(CUSTOM_FIELD_COLUMN_PREFIX.length);
  return FIELD_ID_PATTERN.test(fieldId) ? fieldId : undefined;
};

export interface TaskTableColumnDef {
  readonly defaultWidth: number;
  readonly hideable: boolean;
  // Custom field columns are listed in the hidden-columns state when shown.
  readonly hiddenByDefault?: boolean;
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

export const MAX_CUSTOM_FIELD_COLUMNS = MAX_FIELDS_PER_PROJECT;

export const HIDEABLE_COLUMNS: readonly TaskTableColumnDef[] =
  TASK_TABLE_COLUMNS.filter((column) => column.hideable);

export const GLOBAL_HIDEABLE_COLUMNS: readonly TaskTableColumnDef[] =
  GLOBAL_TASK_COLUMNS.filter((column) => column.hideable);

const CUSTOM_FIELD_COLUMN_WIDTHS = { defaultWidth: 160, minWidth: 100 };

// The column a project's custom field adds. It starts hidden, is not sortable
// and is never one of the built-in columns.
export const customFieldColumn = (field: {
  readonly id: string;
  readonly name: string;
}): TaskTableColumnDef => ({
  ...CUSTOM_FIELD_COLUMN_WIDTHS,
  hiddenByDefault: true,
  hideable: true,
  id: customFieldColumnId(field.id),
  label: field.name,
  sortField: null,
});

const findColumn = (
  id: TaskTableColumnId
): Pick<TaskTableColumnDef, "defaultWidth" | "minWidth"> | undefined =>
  parseCustomFieldColumnId(id) === undefined
    ? [...TASK_TABLE_COLUMNS, PROJECT_COLUMN].find((column) => column.id === id)
    : CUSTOM_FIELD_COLUMN_WIDTHS;

export interface HiddenColumnOptions {
  // Only a project's own table has custom field columns.
  readonly customFields?: boolean;
}

// Custom field columns are off by default, so a cf: id in this list means the
// column is shown. Built-in ids keep their meaning: listed means hidden.
const customColumnIds = (
  ids: Iterable<string>,
  options: HiddenColumnOptions
): CustomFieldColumnId[] => {
  if (!options.customFields) {
    return [];
  }
  const unique = new Set<CustomFieldColumnId>();
  for (const id of ids) {
    const fieldId = parseCustomFieldColumnId(id);
    if (fieldId !== undefined) {
      unique.add(customFieldColumnId(fieldId));
    }
  }
  return [...unique].toSorted().slice(0, MAX_CUSTOM_FIELD_COLUMNS);
};

export const parseHiddenColumns = (
  value: string | null | undefined,
  columns: readonly TaskTableColumnDef[] = HIDEABLE_COLUMNS,
  options: HiddenColumnOptions = {}
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
  return [...ids, ...customColumnIds(requested, options)];
};

export const serializeHiddenColumns = (
  ids: readonly string[],
  columns: readonly TaskTableColumnDef[] = HIDEABLE_COLUMNS,
  options: HiddenColumnOptions = {}
): string => {
  const selected = new Set(ids);
  const ordered: string[] = [];
  for (const column of columns) {
    if (column.hideable && selected.has(column.id)) {
      ordered.push(column.id);
    }
  }
  return [...ordered, ...customColumnIds(selected, options)].join(",");
};

// The columns a table renders for this hidden-columns state.
export const shownColumns = <Column extends TaskTableColumnDef>(
  columns: readonly Column[],
  hidden: readonly string[]
): Column[] => {
  const listed = new Set<string>(hidden);
  return columns.filter(
    (column) => listed.has(column.id) === (column.hiddenByDefault ?? false)
  );
};

// A stored or URL list can name a field that was archived since, so custom
// column ids are kept only for fields that are still active.
export const dropInactiveCustomColumns = (
  ids: readonly TaskTableColumnId[],
  activeFieldIds: readonly string[]
): TaskTableColumnId[] => {
  const active = new Set(activeFieldIds);
  return ids.filter((id) => {
    const fieldId = parseCustomFieldColumnId(id);
    return fieldId === undefined || active.has(fieldId);
  });
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

// Stored widths can name columns from an older layout or an archived field, so
// only known IDs are kept. A custom field column counts as known only when its
// field is in activeFieldIds.
export const columnWidthsFromPreferences = (
  widths?: Readonly<Record<string, number>>,
  activeFieldIds: readonly string[] = []
): Partial<Record<TaskTableColumnId, number>> => {
  const result: Partial<Record<TaskTableColumnId, number>> = {};
  const ids: TaskTableColumnId[] = [
    ...TASK_TABLE_COLUMNS.map((column) => column.id),
    PROJECT_COLUMN.id,
    ...activeFieldIds.map(customFieldColumnId),
  ];
  for (const id of ids) {
    const width = widths?.[id];
    if (width !== undefined) {
      result[id] = clampColumnWidth(id, width);
    }
  }
  return result;
};
