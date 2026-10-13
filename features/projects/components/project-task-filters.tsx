/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle */

"use client";

import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";

export const ProjectTaskFilters = ({
  onPriorityChange,
  onGroupByChange,
  onQueryChange,
  onSortChange,
  onStatusChange,
  priority,
  groupBy,
  projectId,
  taskCount,
  taskTotal,
  showGrouping,
  query,
  sort,
  status,
}: {
  readonly onPriorityChange: (value: string) => void;
  readonly onGroupByChange: (value: string) => void;
  readonly onQueryChange: (value: string) => void;
  readonly onSortChange: (value: string) => void;
  readonly onStatusChange: (value: string) => void;
  readonly priority: string;
  readonly groupBy: string;
  readonly projectId: string;
  readonly taskCount: number;
  readonly taskTotal: number;
  readonly showGrouping: boolean;
  readonly query: string;
  readonly sort: string;
  readonly status: string;
}) => (
  <div
    className={`toolbar project-task-filter${showGrouping ? " project-task-filter-grouped" : ""}`}
  >
    <label className="field" htmlFor={`task-search-${projectId}`}>
      <span className="sr-only">Search project tasks</span>
      <WorkspaceInput
        autoComplete="off"
        className="input"
        id={`task-search-${projectId}`}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        placeholder="Search tasks"
        type="search"
        value={query}
      />
    </label>
    {showGrouping ? (
      <label className="field" htmlFor={`task-group-${projectId}`}>
        <span className="sr-only">Group project tasks</span>
        <WorkspaceSelect
          ariaLabel="Group project tasks"
          id={`task-group-${projectId}`}
          onValueChange={onGroupByChange}
          value={groupBy}
        >
          <WorkspaceSelectItem value="status">
            Group: Status
          </WorkspaceSelectItem>
          <WorkspaceSelectItem value="none">No grouping</WorkspaceSelectItem>
        </WorkspaceSelect>
      </label>
    ) : null}
    <label className="field" htmlFor={`task-status-${projectId}`}>
      <span className="sr-only">Filter tasks by status</span>
      <WorkspaceSelect
        ariaLabel="Filter tasks by status"
        id={`task-status-${projectId}`}
        onValueChange={onStatusChange}
        value={status}
      >
        <WorkspaceSelectItem value="all">All statuses</WorkspaceSelectItem>
        <WorkspaceSelectItem value="backlog">Backlog</WorkspaceSelectItem>
        <WorkspaceSelectItem value="todo">To Do</WorkspaceSelectItem>
        <WorkspaceSelectItem value="progress">In Progress</WorkspaceSelectItem>
        <WorkspaceSelectItem value="review">Review</WorkspaceSelectItem>
        <WorkspaceSelectItem value="done">Done</WorkspaceSelectItem>
      </WorkspaceSelect>
    </label>
    <label className="field" htmlFor={`task-priority-${projectId}`}>
      <span className="sr-only">Filter tasks by priority</span>
      <WorkspaceSelect
        ariaLabel="Filter tasks by priority"
        id={`task-priority-${projectId}`}
        onValueChange={onPriorityChange}
        value={priority}
      >
        <WorkspaceSelectItem value="all">All priorities</WorkspaceSelectItem>
        <WorkspaceSelectItem value="urgent">Urgent</WorkspaceSelectItem>
        <WorkspaceSelectItem value="high">High</WorkspaceSelectItem>
        <WorkspaceSelectItem value="medium">Medium</WorkspaceSelectItem>
        <WorkspaceSelectItem value="low">Low</WorkspaceSelectItem>
        <WorkspaceSelectItem value="none">No priority</WorkspaceSelectItem>
      </WorkspaceSelect>
    </label>
    <label className="field" htmlFor={`task-sort-${projectId}`}>
      <span className="sr-only">Sort project tasks</span>
      <WorkspaceSelect
        ariaLabel="Sort project tasks"
        id={`task-sort-${projectId}`}
        onValueChange={onSortChange}
        value={sort}
      >
        <WorkspaceSelectItem value="manual">Manual order</WorkspaceSelectItem>
        <WorkspaceSelectItem value="name">Name</WorkspaceSelectItem>
        <WorkspaceSelectItem value="due">Due date</WorkspaceSelectItem>
        <WorkspaceSelectItem value="priority">Priority</WorkspaceSelectItem>
      </WorkspaceSelect>
    </label>
    <span className="muted project-task-count">
      {taskCount} of {taskTotal} tasks
    </span>
  </div>
);
