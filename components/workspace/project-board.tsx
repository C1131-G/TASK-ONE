/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { CheckCircle, ListChecks, Repeat } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { changeTaskColumnAction } from "@/app/actions/tasks";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { TaskManageControls } from "@/components/workspace/task-manage-controls";
import { TaskStatusSelect } from "@/components/workspace/task-status-select";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import type { LabelSummary } from "@/src/server/tasks/label-management";
import type { TaskRecurrenceInput } from "@/src/server/work/work-contracts";

import { useProjectViewSearch } from "./use-project-view-search";

interface Task {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly status: "backlog" | "todo" | "progress" | "review" | "done";
  readonly priority: "urgent" | "high" | "medium" | "low" | "none";
  readonly version: number;
  readonly createdById: string;
  readonly assigneeIds: readonly string[];
  readonly description: string | null;
  readonly dueDate: string | null;
  readonly startDate: string | null;
  readonly estimate: string | null;
  readonly projectTaskNumber: number;
  readonly assignees: readonly { readonly id: string; readonly name: string }[];
  readonly labelIds: readonly string[];
  readonly dependencyIds: readonly string[];
  readonly recurrence: TaskRecurrenceInput | null;
  readonly subtaskCount: number;
  readonly completedSubtaskCount: number;
}

interface Employee {
  readonly id: string;
  readonly name: string;
}

const columns = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "progress", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
] as const;

const priorityRank = {
  high: 1,
  low: 3,
  medium: 2,
  none: 4,
  urgent: 0,
} as const;

export const ProjectBoard = ({
  projectKey,
  tasks,
  employees,
  labels,
  currentUserId,
  isAdmin,
}: {
  readonly projectKey: string;
  readonly tasks: readonly Task[];
  readonly employees: readonly Employee[];
  readonly labels: readonly LabelSummary[];
  readonly currentUserId: string | null;
  readonly isAdmin: boolean;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const draggedTaskId = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { search, update: updateSearch } = useProjectViewSearch();
  const { priority: priorityFilter, q: query, sort } = search;
  const setQuery = (value: string) => updateSearch({ q: value });
  const setPriorityFilter = (value: string) =>
    updateSearch({ priority: value });
  const setSort = (value: string) => updateSearch({ sort: value });
  const labelsById = new Map(labels.map((label) => [label.id, label]));

  const visibleTasks = tasks
    .filter((task) => {
      const normalizedQuery = query.trim().toLowerCase();
      const matchesQuery =
        normalizedQuery.length === 0 ||
        task.title.toLowerCase().includes(normalizedQuery) ||
        `${projectKey}-${task.projectTaskNumber}`
          .toLowerCase()
          .includes(normalizedQuery);
      return (
        matchesQuery &&
        (priorityFilter === "all" || task.priority === priorityFilter)
      );
    })
    .toSorted((first, second) => {
      if (sort === "name") {
        return first.title.localeCompare(second.title);
      }
      if (sort === "due") {
        return (first.dueDate ?? "9999-12-31").localeCompare(
          second.dueDate ?? "9999-12-31"
        );
      }
      if (sort === "priority") {
        return priorityRank[first.priority] - priorityRank[second.priority];
      }
      return 0;
    });

  const moveTask = (status: Task["status"]) => {
    const task = tasks.find((item) => item.id === draggedTaskId.current);
    if (!task || task.status === status) {
      draggedTaskId.current = null;
      return;
    }
    startTransition(async () => {
      const result = await changeTaskColumnAction({
        expectedVersion: task.version,
        idempotencyKey: crypto.randomUUID(),
        status,
        taskId: task.id,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });
    draggedTaskId.current = null;
  };

  return (
    <div className="project-board-wrap">
      <div aria-label="Board controls" className="board-toolbar">
        <label className="board-search" htmlFor="project-board-search">
          <span className="sr-only">Search tasks</span>
          <WorkspaceInput
            autoComplete="off"
            className="input"
            id="project-board-search"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search tasks…"
            type="search"
            value={query}
          />
        </label>
        <label className="board-control" htmlFor="project-board-priority">
          <span className="sr-only">Filter by priority</span>
          <WorkspaceSelect
            ariaLabel="Filter by priority"
            id="project-board-priority"
            onValueChange={setPriorityFilter}
            value={priorityFilter}
          >
            <WorkspaceSelectItem value="all">
              All priorities
            </WorkspaceSelectItem>
            <WorkspaceSelectItem value="urgent">Urgent</WorkspaceSelectItem>
            <WorkspaceSelectItem value="high">High</WorkspaceSelectItem>
            <WorkspaceSelectItem value="medium">Medium</WorkspaceSelectItem>
            <WorkspaceSelectItem value="low">Low</WorkspaceSelectItem>
            <WorkspaceSelectItem value="none">No priority</WorkspaceSelectItem>
          </WorkspaceSelect>
        </label>
        <label className="board-control" htmlFor="project-board-sort">
          <span className="sr-only">Sort tasks</span>
          <WorkspaceSelect
            ariaLabel="Sort tasks"
            id="project-board-sort"
            onValueChange={setSort}
            value={sort}
          >
            <WorkspaceSelectItem value="manual">
              Manual order
            </WorkspaceSelectItem>
            <WorkspaceSelectItem value="name">Name</WorkspaceSelectItem>
            <WorkspaceSelectItem value="due">Due date</WorkspaceSelectItem>
            <WorkspaceSelectItem value="priority">Priority</WorkspaceSelectItem>
          </WorkspaceSelect>
        </label>
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <div aria-busy={pending} className="board">
        {columns.map((column) => {
          const columnTasks = visibleTasks.filter(
            (task) => task.status === column.id
          );
          return (
            <section
              aria-label={`${column.label}, ${columnTasks.length} tasks`}
              className="bcol"
              key={column.id}
            >
              <header className="bcol-h">
                <span className={`st ${column.id}`} aria-hidden="true" />
                <span>{column.label}</span>
                <span className="cnt">{columnTasks.length}</span>
              </header>
              <div
                aria-label={`Drop tasks in ${column.label}`}
                className="bcol-b"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  moveTask(column.id);
                }}
              >
                {columnTasks.map((task) => {
                  const canEdit =
                    isAdmin ||
                    task.createdById === currentUserId ||
                    task.assigneeIds.includes(currentUserId ?? "");
                  return (
                    <article
                      aria-labelledby={`task-${task.id}-title`}
                      className={`kcard${task.status === "done" ? " done" : ""}`}
                      draggable={canEdit && !pending}
                      key={task.id}
                      onDragEnd={() => {
                        draggedTaskId.current = null;
                      }}
                      onDragStart={() => {
                        draggedTaskId.current = task.id;
                      }}
                    >
                      {task.labelIds.length > 0 ? (
                        <div className="labels">
                          {task.labelIds.flatMap((labelId) => {
                            const label = labelsById.get(labelId);
                            return label ? (
                              <span
                                className="lbl"
                                key={label.id}
                                style={
                                  { "--c": label.color } as React.CSSProperties
                                }
                              >
                                <span aria-hidden="true" className="lbl-dot" />
                                {label.name}
                              </span>
                            ) : (
                              []
                            );
                          })}
                        </div>
                      ) : null}
                      <div className="top">
                        {task.status === "done" ? (
                          <span className="done-ic">
                            <CheckCircle aria-hidden="true" size={15} />
                            <span className="sr-only">Completed</span>
                          </span>
                        ) : null}
                        <span className="key">
                          {projectKey}-{task.projectTaskNumber}
                        </span>
                        <h3 className="title" id={`task-${task.id}-title`}>
                          {task.title}
                        </h3>
                      </div>
                      {task.subtaskCount > 0 ? (
                        <div className="subp">
                          <ListChecks aria-hidden="true" size={13} />
                          <span>
                            {task.completedSubtaskCount}/{task.subtaskCount}
                          </span>
                          <progress
                            aria-label={`${task.completedSubtaskCount} of ${task.subtaskCount} subtasks complete`}
                            className="board-subtask-progress"
                            max={task.subtaskCount}
                            value={task.completedSubtaskCount}
                          />
                        </div>
                      ) : null}
                      <div className="meta">
                        <span className="m">{task.priority}</span>
                        {task.dueDate ? (
                          <span className="m">{task.dueDate}</span>
                        ) : null}
                        {canEdit ? (
                          <TaskStatusSelect
                            status={task.status}
                            taskId={task.id}
                            version={task.version}
                          />
                        ) : null}
                        {task.recurrence ? (
                          <span className="m">
                            <Repeat aria-hidden="true" size={13} />
                            <span className="sr-only">Recurring task</span>
                          </span>
                        ) : null}
                        {task.assignees.length > 0 ? (
                          <AvatarGroup className="avs">
                            {task.assignees.slice(0, 3).map((assignee) => {
                              const initials = assignee.name
                                .split(" ")
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((part) => part[0]?.toUpperCase() ?? "")
                                .join("");
                              return (
                                <Avatar
                                  className="av sm"
                                  key={assignee.id}
                                  size="sm"
                                >
                                  <AvatarFallback className="av-fallback">
                                    {initials}
                                    <span className="sr-only">
                                      {assignee.name}
                                    </span>
                                  </AvatarFallback>
                                </Avatar>
                              );
                            })}
                            {task.assignees.length > 3 ? (
                              <AvatarGroupCount className="av sm more">
                                <span aria-hidden="true">
                                  +{task.assignees.length - 3}
                                </span>
                                <span className="sr-only">
                                  {task.assignees.length - 3} more assignees
                                </span>
                              </AvatarGroupCount>
                            ) : null}
                          </AvatarGroup>
                        ) : null}
                      </div>
                      <TaskManageControls
                        canEdit={canEdit}
                        currentUserId={currentUserId}
                        employees={employees}
                        isAdmin={isAdmin}
                        task={task}
                      />
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
