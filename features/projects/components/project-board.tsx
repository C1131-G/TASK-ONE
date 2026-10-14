/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import { useBoardReorder } from "@/features/tasks/hooks/use-board-reorder";
import { changeTaskColumnAction } from "@/features/tasks/tasks-actions";
import type { LabelSummary } from "@/src/server/tasks/label-management";

import { useProjectViewSearch } from "../hooks/use-project-view-search";
import type { BoardTask as Task } from "../types/project-board-types";
import { ProjectBoardCard } from "./project-board-card";

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
  // Manual reordering needs the full column in view: no search or priority filter.
  const canReorder =
    sort === "manual" && query.trim() === "" && priorityFilter === "all";

  const reorder = useBoardReorder({
    canReorder,
    onError: setError,
    tasks,
  });
  const handleMove = reorder.move;

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
    const task = tasks.find(({ id }) => id === draggedTaskId.current);
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
      <p aria-live="polite" className="sr-only">
        {reorder.announcement}
      </p>
      {canReorder ? null : (
        <p className="muted board-reorder-hint">
          Clear search and priority filters and sort by manual order to reorder
          cards.
        </p>
      )}
      <section
        aria-busy={pending}
        aria-label="Board columns"
        className="board"
        // A board wider than the screen scrolls sideways, so keyboard users must reach it.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      >
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
                className="bcol-b"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  moveTask(column.id);
                }}
              >
                {columnTasks.map((task) => (
                  <ProjectBoardCard
                    canEdit={
                      isAdmin ||
                      task.createdById === currentUserId ||
                      task.assigneeIds.includes(currentUserId ?? "")
                    }
                    canReorder={canReorder}
                    column={column}
                    currentUserId={currentUserId}
                    employees={employees}
                    isAdmin={isAdmin}
                    key={task.id}
                    labelsById={labelsById}
                    onDragCancel={() => {
                      draggedTaskId.current = null;
                    }}
                    onDragStart={(taskId) => {
                      draggedTaskId.current = taskId;
                    }}
                    onMove={handleMove}
                    projectKey={projectKey}
                    reorderPending={reorder.pending}
                    task={task}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </section>
    </div>
  );
};
