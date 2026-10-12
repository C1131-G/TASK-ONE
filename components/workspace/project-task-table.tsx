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
import { TaskManageControls } from "@/components/workspace/task-manage-controls";
import { TaskStatusSelect } from "@/components/workspace/task-status-select";
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

export const ProjectTaskTable = ({
  currentUserId,
  editableTaskIds,
  employees,
  isAdmin,
  labels,
  groups,
  onSelectAll,
  onSelectTask,
  projectKey,
  selectableTaskIds,
  selectedTaskIds,
  tasks,
}: {
  readonly currentUserId: string | null;
  readonly editableTaskIds: ReadonlySet<string>;
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly isAdmin: boolean;
  readonly labels: readonly LabelSummary[];
  readonly groups: readonly {
    readonly id: string;
    readonly label: string;
    readonly tasks: readonly ProjectTaskTableItem[];
  }[];
  readonly onSelectAll: (selected: boolean) => void;
  readonly onSelectTask: (taskId: string, selected: boolean) => void;
  readonly projectKey: string;
  readonly selectableTaskIds: ReadonlySet<string>;
  readonly selectedTaskIds: ReadonlySet<string>;
  readonly tasks: readonly ProjectTaskTableItem[];
}) => {
  const labelsById = new Map(labels.map((label) => [label.id, label]));
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
          <TableHead>Task</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Assignees</TableHead>
          <TableHead>Start</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>Estimate</TableHead>
          <TableHead>Labels</TableHead>
          <TableHead>Dependencies</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <Fragment key={group.id}>
            {group.label ? (
              <TableRow className="project-task-group-row">
                <TableCell colSpan={11}>
                  {group.label}{" "}
                  <span className="muted">{group.tasks.length}</span>
                </TableCell>
              </TableRow>
            ) : null}
            {group.tasks.map((task) => {
              const editable = editableTaskIds.has(task.id);
              const taskLabels = task.labelIds.flatMap((id) => {
                const label = labelsById.get(id);
                return label ? [label] : [];
              });
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
                  <TableCell
                    className="project-task-name-cell"
                    data-label="Task"
                  >
                    <span className="mono faint">
                      {projectKey}-{task.projectTaskNumber}
                    </span>
                    <span className="project-task-name">{task.title}</span>
                  </TableCell>
                  <TableCell data-label="Status">
                    {editable ? (
                      <TaskStatusSelect
                        status={task.status}
                        taskId={task.id}
                        version={task.version}
                      />
                    ) : (
                      <span className={`pstatus ${task.status}`}>
                        {task.status}
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    className="project-task-priority"
                    data-label="Priority"
                  >
                    {task.priority}
                  </TableCell>
                  <TableCell
                    className="project-task-assignees"
                    data-label="Assignees"
                  >
                    {task.assignees.length
                      ? task.assignees
                          .map((assignee) => assignee.name)
                          .join(", ")
                      : "Unassigned"}
                  </TableCell>
                  <TableCell data-label="Start">
                    {formatDate(task.startDate)}
                  </TableCell>
                  <TableCell data-label="Due">
                    {formatDate(task.dueDate)}
                  </TableCell>
                  <TableCell data-label="Estimate">
                    {task.estimate ?? "—"}
                  </TableCell>
                  <TableCell data-label="Labels">
                    <span className="project-task-labels">
                      {taskLabels.length
                        ? taskLabels.map((label) => (
                            <Badge
                              key={label.id}
                              variant="outline"
                              style={{
                                borderColor: label.color,
                                color: label.color,
                              }}
                            >
                              {label.name}
                            </Badge>
                          ))
                        : "—"}
                    </span>
                  </TableCell>
                  <TableCell data-label="Dependencies">
                    {task.dependencyIds.length
                      ? `${task.dependencyIds.length} task${task.dependencyIds.length === 1 ? "" : "s"}`
                      : "—"}
                  </TableCell>
                  <TableCell data-label="Actions">
                    <TaskManageControls
                      canEdit={editable}
                      currentUserId={currentUserId}
                      employees={employees}
                      isAdmin={isAdmin}
                      task={task}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
};
