/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */
/* eslint-disable shadcn/no-restyle */

"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FavoriteToggle } from "@/components/workspace/favorite-toggle";
import { GlobalTaskBoard } from "@/components/workspace/global-task-board";
import { GlobalTaskBulkDialog } from "@/components/workspace/global-task-bulk-dialog";
import { TaskManageControls } from "@/components/workspace/task-manage-controls";
import { TaskStatusSelect } from "@/components/workspace/task-status-select";
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

const GlobalTaskTable = (props: GlobalTaskViewProps) => (
  <Table>
    <TableCaption className="sr-only">Workspace tasks</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead className="w-10">
          <span className="sr-only">Select</span>
        </TableHead>
        <TableHead>Task</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Assignee</TableHead>
        <TableHead>Priority</TableHead>
        <TableHead>Due date</TableHead>
        <TableHead>Project</TableHead>
        <TableHead>Actions</TableHead>
      </TableRow>
    </TableHeader>
    {props.taskGroups.map((group) => (
      <TableBody key={group.key}>
        <TableRow>
          <TableCell className="font-medium" colSpan={8}>
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
            <TableCell>
              <Link
                className="trunc"
                href={`/projects/${task.projectId}?view=board` as Route}
              >
                <span className="mono faint">
                  {task.projectKey}-{task.projectTaskNumber}
                </span>{" "}
                {task.title}
              </Link>
            </TableCell>
            <TableCell>
              <TaskStatus
                canEdit={canEditTask(task, props.userId, props.isAdmin)}
                task={task}
              />
            </TableCell>
            <TableCell>
              {task.assignees.map(({ name }) => name).join(", ") ||
                "Unassigned"}
            </TableCell>
            <TableCell>{task.priority}</TableCell>
            <TableCell>{task.dueDate ?? "—"}</TableCell>
            <TableCell>
              <Link href={`/projects/${task.projectId}` as Route}>
                {task.projectName}
              </Link>
            </TableCell>
            <TableCell>
              <TaskActions {...props} task={task} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    ))}
  </Table>
);

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
  const tasks = props.taskGroups.flatMap((group) => group.tasks);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    new Set()
  );
  const selectedTasks = tasks.filter((task) => selectedIds.has(task.id));
  const selectionLimitReached = selectedIds.size >= 100;

  const onToggle = (taskId: string, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked && current.size >= 100) {
        return current;
      }
      const next = new Set(current);
      if (checked) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  };

  const selectAll = (checked: boolean) => {
    setSelectedIds(
      checked ? new Set(tasks.slice(0, 100).map((task) => task.id)) : new Set()
    );
  };

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
    content = <GlobalTaskTable {...viewProps} />;
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
          {tasks.length > 100 ? "Select first 100 tasks" : "Select all tasks"}
        </label>
        <span aria-live="polite" className="muted">
          {selectedIds.size} selected{selectionLimitReached ? " (maximum)" : ""}
        </span>
        {selectedTasks.length > 0 ? (
          <GlobalTaskBulkDialog
            employees={props.employees}
            onSuccess={() => setSelectedIds(new Set())}
            tasks={selectedTasks}
          />
        ) : null}
      </div>
      {content}
    </>
  );
};
