/* eslint-disable shadcn/no-inline-styles, shadcn/no-restyle, shadcn/no-unknown-classes */

"use client";

import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCustomFieldValue } from "@/features/custom-fields/custom-field-format";
import { TaskManageControls } from "@/features/tasks/components/task-manage-controls";
import { TaskStatusSelect } from "@/features/tasks/components/task-status-select";
import { TaskTableHeaderCell } from "@/features/tasks/components/task-table-header-cell";
import type {
  TaskTableColumn,
  TaskTableColumnDef,
  TaskTableColumnId,
} from "@/features/tasks/task-table-columns";
import {
  TASK_TABLE_COLUMNS,
  customFieldColumn,
  defaultColumnWidth,
  shownColumns,
} from "@/features/tasks/task-table-columns";
import type {
  CustomFieldView,
  ProjectCustomFieldTable,
} from "@/src/server/custom-fields/custom-field-contracts";
import type { LabelSummary } from "@/src/server/tasks/label-management";
import type { ProjectTaskListItem } from "@/src/server/work/work-contracts";

type ProjectTaskTableItem = Pick<
  ProjectTaskListItem,
  | "assignees"
  | "assigneeIds"
  | "createdById"
  | "description"
  | "dependencyIds"
  | "dueDate"
  | "estimate"
  | "id"
  | "labelIds"
  | "priority"
  | "projectId"
  | "projectTaskNumber"
  | "recurrence"
  | "startDate"
  | "status"
  | "title"
  | "version"
>;

const DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const formatDate = (date: string | null): string => {
  if (!date) {
    return "—";
  }
  return DATE_FORMATTER.format(new Date(`${date}T12:00:00Z`));
};

const isBuiltInColumn = (
  column: TaskTableColumnDef
): column is TaskTableColumn =>
  TASK_TABLE_COLUMNS.some(({ id }) => id === column.id);

// Custom field columns sit after the built-in ones, before the actions column.
const withCustomColumns = (
  customFields: readonly CustomFieldView[]
): readonly TaskTableColumnDef[] => [
  ...TASK_TABLE_COLUMNS.filter(({ id }) => id !== "actions"),
  ...customFields.map(customFieldColumn),
  ...TASK_TABLE_COLUMNS.filter(({ id }) => id === "actions"),
];

export const ProjectTaskTable = ({
  activeSort,
  columnWidths,
  currentUserId,
  customFields,
  customValues,
  editableTaskIds,
  employees,
  hiddenColumns,
  isAdmin,
  labels,
  groups,
  onResizeColumn,
  onSelectAll,
  onSelectTask,
  onSort,
  projectKey,
  selectableTaskIds,
  selectedTaskIds,
  tasks,
}: {
  readonly activeSort: string;
  readonly columnWidths: Partial<Record<TaskTableColumnId, number>>;
  readonly currentUserId: string | null;
  readonly customFields: readonly CustomFieldView[];
  readonly customValues: ProjectCustomFieldTable["values"];
  readonly editableTaskIds: ReadonlySet<string>;
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly hiddenColumns: readonly TaskTableColumnId[];
  readonly isAdmin: boolean;
  readonly labels: readonly LabelSummary[];
  readonly groups: readonly {
    readonly id: string;
    readonly label: string;
    readonly tasks: readonly ProjectTaskTableItem[];
  }[];
  readonly onResizeColumn: (columnId: TaskTableColumnId, width: number) => void;
  readonly onSelectAll: (selected: boolean) => void;
  readonly onSelectTask: (taskId: string, selected: boolean) => void;
  readonly onSort: (field: string) => void;
  readonly projectKey: string;
  readonly selectableTaskIds: ReadonlySet<string>;
  readonly selectedTaskIds: ReadonlySet<string>;
  readonly tasks: readonly ProjectTaskTableItem[];
}) => {
  const labelsById = new Map(labels.map((label) => [label.id, label]));
  const fieldsByColumnId = new Map(
    customFields.map((field) => [customFieldColumn(field).id, field])
  );
  const visibleColumns = shownColumns(
    withCustomColumns(customFields),
    hiddenColumns
  );
  const selectableCount = tasks.filter((task) =>
    selectableTaskIds.has(task.id)
  ).length;
  const selectedCount = tasks.filter((task) =>
    selectedTaskIds.has(task.id)
  ).length;
  const allSelected = selectableCount > 0 && selectedCount === selectableCount;
  const someSelected = selectedCount > 0 && !allSelected;
  let headerChecked: boolean | "indeterminate" = false;
  if (allSelected) {
    headerChecked = true;
  } else if (someSelected) {
    headerChecked = "indeterminate";
  }

  const widthOf = (column: TaskTableColumnDef) =>
    columnWidths[column.id] ?? defaultColumnWidth(column.id);

  const renderCustomCell = (
    column: TaskTableColumnDef,
    task: ProjectTaskTableItem
  ) => {
    const field = fieldsByColumnId.get(column.id);
    return field
      ? formatCustomFieldValue(field.type, customValues[task.id]?.[field.id])
      : "—";
  };

  const renderCell = (
    column: TaskTableColumn,
    task: ProjectTaskTableItem,
    editable: boolean
  ) => {
    switch (column.id) {
      case "task": {
        return (
          <>
            <span className="mono faint">
              {projectKey}-{task.projectTaskNumber}
            </span>
            <span className="project-task-name">{task.title}</span>
          </>
        );
      }
      case "status": {
        return editable ? (
          <TaskStatusSelect
            status={task.status}
            taskId={task.id}
            version={task.version}
          />
        ) : (
          <span className={`pstatus ${task.status}`}>{task.status}</span>
        );
      }
      case "priority": {
        return task.priority;
      }
      case "assignees": {
        return task.assignees.length
          ? task.assignees.map((assignee) => assignee.name).join(", ")
          : "Unassigned";
      }
      case "start": {
        return formatDate(task.startDate);
      }
      case "due": {
        return formatDate(task.dueDate);
      }
      case "estimate": {
        return task.estimate ?? "—";
      }
      case "labels": {
        const taskLabels = task.labelIds.flatMap((id) => {
          const label = labelsById.get(id);
          return label ? [label] : [];
        });
        return (
          <span className="project-task-labels">
            {taskLabels.length
              ? taskLabels.map((label) => (
                  <Badge
                    key={label.id}
                    style={{ borderColor: label.color, color: label.color }}
                    variant="outline"
                  >
                    {label.name}
                  </Badge>
                ))
              : "—"}
          </span>
        );
      }
      case "dependencies": {
        return task.dependencyIds.length
          ? `${task.dependencyIds.length} task${task.dependencyIds.length === 1 ? "" : "s"}`
          : "—";
      }
      case "actions": {
        return (
          <TaskManageControls
            canEdit={editable}
            currentUserId={currentUserId}
            employees={employees}
            isAdmin={isAdmin}
            task={task}
          />
        );
      }
      default: {
        const _exhaustive: never = column;
        return _exhaustive;
      }
    }
  };

  return (
    <Table className="project-task-data-table">
      <TableCaption className="sr-only">
        Tasks in the {projectKey} project
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Checkbox
              aria-label="Select up to 100 editable tasks in this view"
              checked={headerChecked}
              disabled={selectableCount === 0}
              onCheckedChange={(checked) => onSelectAll(checked === true)}
            />
          </TableHead>
          {visibleColumns.map((column) => (
            <TaskTableHeaderCell
              activeSort={activeSort}
              column={column}
              key={column.id}
              onResize={onResizeColumn}
              onSort={onSort}
              width={widthOf(column)}
            />
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <Fragment key={group.id}>
            {group.label ? (
              <TableRow className="project-task-group-row">
                <TableCell colSpan={visibleColumns.length + 1}>
                  {group.label}{" "}
                  <span className="muted">{group.tasks.length}</span>
                </TableCell>
              </TableRow>
            ) : null}
            {group.tasks.map((task) => {
              const editable = editableTaskIds.has(task.id);
              return (
                <TableRow key={task.id}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${projectKey}-${task.projectTaskNumber} ${task.title}`}
                      checked={selectedTaskIds.has(task.id)}
                      disabled={
                        !selectableTaskIds.has(task.id) ||
                        (selectedTaskIds.size >= 100 &&
                          !selectedTaskIds.has(task.id))
                      }
                      onCheckedChange={(checked) =>
                        onSelectTask(task.id, checked === true)
                      }
                    />
                  </TableCell>
                  {visibleColumns.map((column) => (
                    <TableCell
                      className={
                        column.id === "task"
                          ? "project-task-name-cell"
                          : undefined
                      }
                      data-label={column.label}
                      key={column.id}
                    >
                      {isBuiltInColumn(column)
                        ? renderCell(column, task, editable)
                        : renderCustomCell(column, task)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
};
