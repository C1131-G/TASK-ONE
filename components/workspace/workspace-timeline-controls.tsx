/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceCombobox } from "@/components/workspace/workspace-combobox";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";

import type {
  TimelineEmployee,
  TimelineScale,
} from "./workspace-timeline-types";

const STATUS_LABELS = {
  backlog: "Backlog",
  done: "Done",
  progress: "In Progress",
  review: "Review",
  todo: "To Do",
} as const;

const PRIORITY_LABELS = {
  high: "High",
  low: "Low",
  medium: "Medium",
  none: "No priority",
  urgent: "Urgent",
} as const;

export const WorkspaceTimelineControls = ({
  id,
  employees,
  query,
  status,
  priority,
  assignee,
  sortBy,
  groupBy,
  scale,
  onQueryChange,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onSortChange,
  onGroupChange,
  onScaleChange,
  onToday,
}: {
  readonly id: string;
  readonly employees: readonly TimelineEmployee[];
  readonly query: string;
  readonly status: string;
  readonly priority: string;
  readonly assignee: string;
  readonly sortBy: string;
  readonly groupBy: string;
  readonly scale: TimelineScale;
  readonly onQueryChange: (value: string) => void;
  readonly onStatusChange: (value: string) => void;
  readonly onPriorityChange: (value: string) => void;
  readonly onAssigneeChange: (value: string) => void;
  readonly onSortChange: (value: string) => void;
  readonly onGroupChange: (value: string) => void;
  readonly onScaleChange: (value: TimelineScale) => void;
  readonly onToday: () => void;
}) => (
  <div className="panel-h timeline-panel-header">
    <h2>Work timeline</h2>
    <fieldset className="toolbar timeline-toolbar">
      <legend className="sr-only">Timeline controls</legend>
      <label className="field timeline-search" htmlFor={`${id}-search`}>
        <span className="sr-only">Search timeline tasks</span>
        <WorkspaceInput
          autoComplete="off"
          id={`${id}-search`}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          placeholder="Search tasks"
          type="search"
          value={query}
        />
      </label>
      <label className="field" htmlFor={`${id}-status`}>
        <span className="sr-only">Filter by status</span>
        <WorkspaceSelect
          ariaLabel="Filter timeline by status"
          id={`${id}-status`}
          onValueChange={onStatusChange}
          value={status}
        >
          <WorkspaceSelectItem value="all">All statuses</WorkspaceSelectItem>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <WorkspaceSelectItem key={value} value={value}>
              {label}
            </WorkspaceSelectItem>
          ))}
        </WorkspaceSelect>
      </label>
      <label className="field" htmlFor={`${id}-priority`}>
        <span className="sr-only">Filter by priority</span>
        <WorkspaceSelect
          ariaLabel="Filter timeline by priority"
          id={`${id}-priority`}
          onValueChange={onPriorityChange}
          value={priority}
        >
          <WorkspaceSelectItem value="all">All priorities</WorkspaceSelectItem>
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <WorkspaceSelectItem key={value} value={value}>
              {label}
            </WorkspaceSelectItem>
          ))}
        </WorkspaceSelect>
      </label>
      <label className="field" htmlFor={`${id}-assignee`}>
        <span className="sr-only">Filter by assignee</span>
        <WorkspaceCombobox
          ariaLabel="Filter timeline by assignee"
          emptyMessage="No employees found."
          id={`${id}-assignee`}
          onValueChange={onAssigneeChange}
          options={[
            { label: "All assignees", value: "all" },
            ...employees.map((employee) => ({
              label: employee.name,
              value: employee.id,
            })),
          ]}
          placeholder="All assignees"
          searchPlaceholder="Search employees"
          value={assignee}
        />
      </label>
      <label className="field" htmlFor={`${id}-sort`}>
        <span className="sr-only">Sort timeline</span>
        <WorkspaceSelect
          ariaLabel="Sort timeline tasks"
          id={`${id}-sort`}
          onValueChange={onSortChange}
          value={sortBy}
        >
          <WorkspaceSelectItem value="manual">Sort: Manual</WorkspaceSelectItem>
          <WorkspaceSelectItem value="startDate">
            Sort: Start date
          </WorkspaceSelectItem>
          <WorkspaceSelectItem value="dueDate">
            Sort: Due date
          </WorkspaceSelectItem>
          <WorkspaceSelectItem value="title">Sort: Title</WorkspaceSelectItem>
          <WorkspaceSelectItem value="priority">
            Sort: Priority
          </WorkspaceSelectItem>
        </WorkspaceSelect>
      </label>
      <label className="field" htmlFor={`${id}-group`}>
        <span className="sr-only">Group timeline tasks</span>
        <WorkspaceSelect
          ariaLabel="Group timeline tasks"
          id={`${id}-group`}
          onValueChange={onGroupChange}
          value={groupBy}
        >
          <WorkspaceSelectItem value="project">
            Group: Project
          </WorkspaceSelectItem>
          <WorkspaceSelectItem value="status">
            Group: Status
          </WorkspaceSelectItem>
          <WorkspaceSelectItem value="assignee">
            Group: Assignee
          </WorkspaceSelectItem>
          <WorkspaceSelectItem value="none">Group: None</WorkspaceSelectItem>
        </WorkspaceSelect>
      </label>
      <fieldset className="timeline-scale">
        <legend className="sr-only">Timeline scale</legend>
        <WorkspaceButton
          aria-pressed={scale === "week"}
          onClick={() => onScaleChange("week")}
          type="button"
          variant={scale === "week" ? "secondary" : "ghost"}
        >
          Weeks
        </WorkspaceButton>
        <WorkspaceButton
          aria-pressed={scale === "month"}
          onClick={() => onScaleChange("month")}
          type="button"
          variant={scale === "month" ? "secondary" : "ghost"}
        >
          Months
        </WorkspaceButton>
      </fieldset>
      <WorkspaceButton onClick={onToday} type="button" variant="outline">
        Today
      </WorkspaceButton>
    </fieldset>
  </div>
);
