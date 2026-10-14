/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */
/* eslint-disable shadcn/no-restyle */

"use client";

import Link from "next/link";
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
import { TaskManageControls } from "@/features/tasks/components/task-manage-controls";
import { TaskStatusSelect } from "@/features/tasks/components/task-status-select";
import { TaskTableHeaderCell } from "@/features/tasks/components/task-table-header-cell";
import type {
  TaskTableColumnDef,
  TaskTableColumnId,
} from "@/features/tasks/task-table-columns";
import {
  GLOBAL_TASK_COLUMNS,
  defaultColumnWidth,
} from "@/features/tasks/task-table-columns";
import type {
  GlobalTask,
  GlobalTaskViewProps,
} from "@/features/tasks/types/global-task-row-contracts";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";

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
  columnId: (typeof GLOBAL_TASK_COLUMNS)[number]["id"],
  task: GlobalTask,
  props: GlobalTaskViewProps
): ReactNode => {
  switch (columnId) {
    case "task": {
      return (
        <Link className="trunc" href={`/projects/${task.projectId}?view=board`}>
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
        <Link href={`/projects/${task.projectId}`}>{task.projectName}</Link>
      );
    }
    case "actions": {
      return <TaskActions {...props} task={task} />;
    }
    default: {
      const _exhaustive: never = columnId;
      return _exhaustive;
    }
  }
};

export const GlobalTaskTable = ({
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
  const visibleColumns = GLOBAL_TASK_COLUMNS.filter(
    (column) => !hidden.includes(column.id)
  );
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

export const GlobalTaskList = ({
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
                    href={`/projects/${task.projectId}?view=board`}
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
                  <Link href={`/projects/${task.projectId}`}>
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
