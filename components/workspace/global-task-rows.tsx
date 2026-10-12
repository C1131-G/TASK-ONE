/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useSelector } from "@tanstack/react-store";
import type { Route } from "next";
import Link from "next/link";
import { useMemo } from "react";
import type { ReactNode } from "react";

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
import { FavoriteToggle } from "@/components/workspace/favorite-toggle";
import { GlobalTaskBoard } from "@/components/workspace/global-task-board";
import { GlobalTaskBulkDialog } from "@/components/workspace/global-task-bulk-dialog";
import {
  GLOBAL_TASK_VIEWS,
  serializeGlobalTaskHidden,
} from "@/components/workspace/global-task-view-state";
import { TaskManageControls } from "@/components/workspace/task-manage-controls";
import { TaskStatusSelect } from "@/components/workspace/task-status-select";
import { TaskTableColumnMenu } from "@/components/workspace/task-table-column-menu";
import type {
  TaskTableColumnDef,
  TaskTableColumnId,
} from "@/components/workspace/task-table-columns";
import {
  GLOBAL_HIDEABLE_COLUMNS,
  GLOBAL_TASK_COLUMNS,
  defaultColumnWidth,
} from "@/components/workspace/task-table-columns";
import { TaskTableHeaderCell } from "@/components/workspace/task-table-header-cell";
import { useGlobalTaskView } from "@/components/workspace/use-global-task-view";
import { useGlobalTaskViewStore } from "@/components/workspace/view-store/global-task-view-store-provider";
import { MAX_BULK_SELECTION } from "@/components/workspace/view-store/project-view-store";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { ProjectTaskListItem } from "@/src/server/work/work-contracts";

type GlobalTask = Omit<
  ProjectTaskListItem,
  "completionUndo" | "recurrenceSuccessorId"
> & {
  readonly projectKey: string;
  readonly projectName: string;
};

interface TaskGroup {
  readonly key: string;
  readonly label: string;
  readonly tasks: readonly GlobalTask[];
}

interface GlobalTaskRowsProps {
  readonly taskGroups: readonly TaskGroup[];
  readonly favoriteTaskIds: ReadonlySet<string>;
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly userId: string | null;
  readonly isAdmin: boolean;
  readonly view: "list" | "board" | "table";
}

interface TaskSelectionProps {
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggle: (taskId: string, checked: boolean) => void;
}

type GlobalTaskViewProps = GlobalTaskRowsProps & TaskSelectionProps;

const canEditTask = (
  task: GlobalTask,
  userId: string | null,
  isAdmin: boolean
): boolean =>
  isAdmin ||
  task.createdById === userId ||
  task.assigneeIds.includes(userId ?? "");

const TaskStatus = ({
  task,
  canEdit,
}: {
  readonly task: GlobalTask;
  readonly canEdit: boolean;
}) =>
  canEdit ? (
    <TaskStatusSelect
      status={task.status}
      taskId={task.id}
      version={task.version}
    />
  ) : (
    <span className={`pstatus ${task.status}`}>{task.status}</span>
  );

const TaskActions = ({
  task,
  favoriteTaskIds,
  employees,
  userId,
  isAdmin,
}: {
  readonly task: GlobalTask;
  readonly favoriteTaskIds: ReadonlySet<string>;
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly userId: string | null;
  readonly isAdmin: boolean;
}) => (
  <div className="c-meta row">
    <FavoriteToggle
      id={task.id}
      initialFavorite={favoriteTaskIds.has(task.id)}
      kind="task"
    />
    <TaskManageControls
      canEdit={canEditTask(task, userId, isAdmin)}
      currentUserId={userId}
      employees={employees}
      isAdmin={isAdmin}
      task={task}
    />
  </div>
);

const renderGlobalCell = (
  columnId: TaskTableColumnId,
  task: GlobalTask,
  props: GlobalTaskViewProps
): ReactNode => {
  switch (columnId) {
    case "task": {
      return (
        <Link
          className="trunc"
          href={`/projects/${task.projectId}?view=board` as Route}
        >
          <span className="mono faint">
            {task.projectKey}-{task.projectTaskNumber}
          </span>{" "}
          {task.title}
        </Link>
      );
    }
    case "status": {
      return (
        <TaskStatus
          canEdit={canEditTask(task, props.userId, props.isAdmin)}
          task={task}
        />
      );
    }
    case "assignees": {
      return task.assignees.length
        ? task.assignees.map(({ name }) => name).join(", ")
        : "Unassigned";
    }
    case "priority": {
      return task.priority;
    }
    case "due": {
      return task.dueDate ?? "—";
    }
    case "project": {
      return (
        <Link href={`/projects/${task.projectId}` as Route}>
          {task.projectName}
        </Link>
      );
    }
    case "actions": {
      return <TaskActions {...props} task={task} />;
    }
    default: {
      return null;
    }
  }
};

const GlobalTaskTable = ({
  activeSort,
  columnWidths,
  hidden,
  onResize,
  onSort,
  props,
}: {
  readonly activeSort: string;
  readonly columnWidths: Partial<Record<TaskTableColumnId, number>>;
  readonly hidden: readonly TaskTableColumnId[];
  readonly onResize: (columnId: TaskTableColumnId, width: number) => void;
  readonly onSort: (field: string) => void;
  readonly props: GlobalTaskViewProps;
}) => {
  const visibleColumns: readonly TaskTableColumnDef[] =
    GLOBAL_TASK_COLUMNS.filter((column) => !hidden.includes(column.id));
  const widthOf = (column: TaskTableColumnDef) =>
    columnWidths[column.id] ?? defaultColumnWidth(column.id);

  return (
    <Table className="project-task-data-table">
      <TableCaption className="sr-only">Workspace tasks</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <span className="sr-only">Select</span>
          </TableHead>
          {visibleColumns.map((column) => (
            <TaskTableHeaderCell
              activeSort={activeSort}
              column={column}
              key={column.id}
              onResize={onResize}
              onSort={onSort}
              width={widthOf(column)}
            />
          ))}
        </TableRow>
      </TableHeader>
      {props.taskGroups.map((group) => (
        <TableBody key={group.key}>
          <TableRow className="project-task-group-row">
            <TableCell colSpan={visibleColumns.length + 1}>
              {group.label} <span className="muted">{group.tasks.length}</span>
            </TableCell>
          </TableRow>
          {group.tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell>
                <Checkbox
                  aria-label={`Select ${task.title}`}
                  checked={props.selectedIds.has(task.id)}
                  onCheckedChange={(checked) =>
                    props.onToggle(task.id, checked === true)
                  }
                />
              </TableCell>
              {visibleColumns.map((column) => (
                <TableCell data-label={column.label} key={column.id}>
                  {renderGlobalCell(column.id, task, props)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      ))}
    </Table>
  );
};

const GlobalTaskList = ({
  taskGroups,
  favoriteTaskIds,
  employees,
  userId,
  isAdmin,
  selectedIds,
  onToggle,
}: GlobalTaskViewProps) => (
  <div className="list-wrap">
    <div className="tlist task-table-global">
      <div className="thead">
        <div>
          <span className="sr-only">Select</span>
        </div>
        <div>Task</div>
        <div>Status</div>
        <div>Assignee</div>
        <div>Priority</div>
        <div>Due date</div>
        <div>Project</div>
        <div>Actions</div>
      </div>
      {taskGroups.map((group) => (
        <div className="task-group" key={group.key}>
          <h2 className="task-group-heading">
            {group.label} <span>{group.tasks.length}</span>
          </h2>
          {group.tasks.map((task) => {
            const canEdit = canEditTask(task, userId, isAdmin);

            return (
              <div className="trow" key={task.id}>
                <div className="ttl">
                  <Checkbox
                    aria-label={`Select ${task.title}`}
                    checked={selectedIds.has(task.id)}
                    onCheckedChange={(checked) =>
                      onToggle(task.id, checked === true)
                    }
                  />
                  <span className="mono faint">
                    {task.projectKey}-{task.projectTaskNumber}
                  </span>
                  <Link
                    className="trunc"
                    href={`/projects/${task.projectId}?view=board` as Route}
                  >
                    {task.title}
                  </Link>
                </div>
                <div className="c-meta">
                  <TaskStatus task={task} canEdit={canEdit} />
                </div>
                <div className="c-meta">
                  {task.assignees.length
                    ? task.assignees.map(({ name }) => name).join(", ")
                    : "Unassigned"}
                </div>
                <div className="c-meta">{task.priority}</div>
                <div className="c-meta num">{task.dueDate ?? "—"}</div>
                <div className="c-meta">
                  <Link href={`/projects/${task.projectId}` as Route}>
                    {task.projectName}
                  </Link>
                </div>
                <TaskActions
                  {...{ employees, favoriteTaskIds, isAdmin, userId }}
                  task={task}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  </div>
);

export const GlobalTaskRows = (props: GlobalTaskRowsProps) => {
  const store = useGlobalTaskViewStore();
  const { search, update } = useGlobalTaskView(GLOBAL_TASK_VIEWS);
  const selectedTaskIdList = useSelector(
    store,
    (state) => state.selectedTaskIds
  );
  const columnWidths = useSelector(store, (state) => state.columnWidths);
  const selectedIds: ReadonlySet<string> = useMemo(
    () => new Set(selectedTaskIdList),
    [selectedTaskIdList]
  );
  const tasks = props.taskGroups.flatMap((group) => group.tasks);
  const selectedTasks = tasks.filter((task) => selectedIds.has(task.id));
  const selectionLimitReached = selectedTasks.length >= MAX_BULK_SELECTION;

  const onToggle = (taskId: string, checked: boolean) =>
    store.actions.toggleTaskSelected(taskId, checked);
  const selectAll = (checked: boolean) =>
    store.actions.setSelectedTaskIds(
      checked ? tasks.map((task) => task.id) : []
    );
  const sortByColumn = (field: string) =>
    update({ sort: search.sort === field ? "due" : field });

  const viewProps: GlobalTaskViewProps = { ...props, onToggle, selectedIds };
  let content: ReactNode;
  if (props.view === "board") {
    content = (
      <GlobalTaskBoard
        employees={props.employees}
        favoriteTaskIds={props.favoriteTaskIds}
        isAdmin={props.isAdmin}
        onToggle={onToggle}
        selectedIds={selectedIds}
        taskGroups={props.taskGroups}
        userId={props.userId}
      />
    );
  } else if (props.view === "table") {
    content = (
      <GlobalTaskTable
        activeSort={search.sort}
        columnWidths={columnWidths}
        hidden={search.hidden}
        onResize={(columnId, width) =>
          store.actions.setColumnWidth(columnId, width)
        }
        onSort={sortByColumn}
        props={viewProps}
      />
    );
  } else {
    content = <GlobalTaskList {...viewProps} />;
  }

  return (
    <>
      <div className="row global-task-selection-bar">
        <label className="row" htmlFor="global-task-select-all">
          <Checkbox
            checked={
              tasks.length > 0 &&
              tasks.every((task) => selectedIds.has(task.id))
            }
            id="global-task-select-all"
            onCheckedChange={(checked) => selectAll(checked === true)}
          />
          {tasks.length > MAX_BULK_SELECTION
            ? `Select first ${MAX_BULK_SELECTION} tasks`
            : "Select all tasks"}
        </label>
        <span aria-live="polite" className="muted">
          {selectedTasks.length} selected
          {selectionLimitReached ? " (maximum)" : ""}
        </span>
        {selectedTasks.length > 0 ? (
          <GlobalTaskBulkDialog
            employees={props.employees}
            onSuccess={() => store.actions.clearSelection()}
            tasks={selectedTasks}
          />
        ) : null}
        {props.view === "table" ? (
          <TaskTableColumnMenu
            columns={GLOBAL_HIDEABLE_COLUMNS}
            hidden={search.hidden}
            onHiddenChange={(next) =>
              update({ hidden: serializeGlobalTaskHidden(next) })
            }
          />
        ) : null}
      </div>
      {content}
    </>
  );
};
