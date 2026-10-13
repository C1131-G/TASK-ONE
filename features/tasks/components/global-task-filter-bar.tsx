/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle */

"use client";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";

import type { GlobalTaskSearch } from "../global-task-view-state";

// Filters write to the store as the user changes them: no Apply step, and no
// server round trip, because the rows are already loaded.
export const GlobalTaskFilterBar = ({
  idPrefix,
  onChange,
  raw,
  searchLabel,
  showGroup,
}: {
  readonly idPrefix: string;
  readonly onChange: (patch: Partial<GlobalTaskSearch>) => void;
  readonly raw: GlobalTaskSearch;
  readonly searchLabel: string;
  readonly showGroup: boolean;
}) => (
  <div className="toolbar task-filter">
    <label className="field" htmlFor={`${idPrefix}-search`}>
      <span className="sr-only">{searchLabel}</span>
      <WorkspaceInput
        aria-label={searchLabel}
        autoComplete="off"
        className="input"
        id={`${idPrefix}-search`}
        name="q"
        onChange={(event) => onChange({ q: event.currentTarget.value })}
        placeholder="Search tasks"
        type="search"
        value={raw.q}
      />
    </label>
    <label className="field" htmlFor={`${idPrefix}-status`}>
      <span className="sr-only">Filter status</span>
      <WorkspaceSelect
        ariaLabel="Filter by status"
        className="input"
        id={`${idPrefix}-status`}
        onValueChange={(status) => onChange({ status })}
        value={raw.status}
      >
        <WorkspaceSelectItem value="all">All statuses</WorkspaceSelectItem>
        <WorkspaceSelectItem value="backlog">Backlog</WorkspaceSelectItem>
        <WorkspaceSelectItem value="todo">To Do</WorkspaceSelectItem>
        <WorkspaceSelectItem value="progress">In Progress</WorkspaceSelectItem>
        <WorkspaceSelectItem value="review">Review</WorkspaceSelectItem>
        <WorkspaceSelectItem value="done">Done</WorkspaceSelectItem>
      </WorkspaceSelect>
    </label>
    <label className="field" htmlFor={`${idPrefix}-priority`}>
      <span className="sr-only">Filter priority</span>
      <WorkspaceSelect
        ariaLabel="Filter by priority"
        className="input"
        id={`${idPrefix}-priority`}
        onValueChange={(priority) => onChange({ priority })}
        value={raw.priority}
      >
        <WorkspaceSelectItem value="all">All priorities</WorkspaceSelectItem>
        <WorkspaceSelectItem value="urgent">Urgent</WorkspaceSelectItem>
        <WorkspaceSelectItem value="high">High</WorkspaceSelectItem>
        <WorkspaceSelectItem value="medium">Medium</WorkspaceSelectItem>
        <WorkspaceSelectItem value="low">Low</WorkspaceSelectItem>
        <WorkspaceSelectItem value="none">No priority</WorkspaceSelectItem>
      </WorkspaceSelect>
    </label>
    <label className="field" htmlFor={`${idPrefix}-sort`}>
      <span className="sr-only">Sort tasks</span>
      <WorkspaceSelect
        ariaLabel="Sort tasks"
        className="input"
        id={`${idPrefix}-sort`}
        onValueChange={(sort) => onChange({ sort })}
        value={raw.sort}
      >
        <WorkspaceSelectItem value="due">Sort: Due date</WorkspaceSelectItem>
        <WorkspaceSelectItem value="priority">
          Sort: Priority
        </WorkspaceSelectItem>
        <WorkspaceSelectItem value="title">Sort: Name</WorkspaceSelectItem>
      </WorkspaceSelect>
    </label>
    {showGroup ? (
      <label className="field" htmlFor={`${idPrefix}-group`}>
        <span className="sr-only">Group tasks</span>
        <WorkspaceSelect
          ariaLabel="Group tasks"
          className="input"
          id={`${idPrefix}-group`}
          onValueChange={(group) => onChange({ group })}
          value={raw.group}
        >
          <WorkspaceSelectItem value="status">
            Group: Status
          </WorkspaceSelectItem>
          <WorkspaceSelectItem value="project">
            Group: Project
          </WorkspaceSelectItem>
          <WorkspaceSelectItem value="assignee">
            Group: Assignee
          </WorkspaceSelectItem>
          <WorkspaceSelectItem value="priority">
            Group: Priority
          </WorkspaceSelectItem>
          <WorkspaceSelectItem value="none">No grouping</WorkspaceSelectItem>
        </WorkspaceSelect>
      </label>
    ) : null}
    {raw.overdue === "true" ? (
      <WorkspaceButton
        className="btn btn-sm btn-secondary"
        onClick={() => onChange({ overdue: "" })}
        type="button"
      >
        Show all due dates
      </WorkspaceButton>
    ) : null}
  </div>
);
