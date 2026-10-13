/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { ArrowsDownUp, FunnelSimple } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";

const sortLabels: Readonly<Record<string, string>> = {
  dueDate: "Due date",
  manual: "Manual",
  name: "Name",
  priority: "Priority",
};

const CalendarToolbar = ({
  query,
  onQueryChange,
  status,
  onStatusChange,
  priority,
  onPriorityChange,
  sort,
  onSortChange,
}: {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly status: string;
  readonly onStatusChange: (status: string) => void;
  readonly priority: string;
  readonly onPriorityChange: (priority: string) => void;
  readonly sort: string;
  readonly onSortChange: (sort: string) => void;
}) => (
  <div className="toolbar calendar-toolbar">
    <div className="calendar-search">
      <WorkspaceInput
        aria-label="Search calendar tasks"
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        placeholder="Search tasks"
        type="search"
        value={query}
      />
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Filter calendar tasks" size="sm" variant="outline">
          <FunnelSimple aria-hidden="true" size={16} /> Filter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-56"
        data-workspace-menu=""
      >
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        <DropdownMenuRadioGroup onValueChange={onStatusChange} value={status}>
          <DropdownMenuRadioItem value="all">
            All statuses
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="backlog">Backlog</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="todo">To Do</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="progress">
            In Progress
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="review">Review</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="done">Done</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Priority</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          onValueChange={onPriorityChange}
          value={priority}
        >
          <DropdownMenuRadioItem value="all">
            All priorities
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="urgent">Urgent</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="high">High</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="medium">Medium</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="low">Low</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="none">
            No priority
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost">
          <ArrowsDownUp aria-hidden="true" size={16} />
          Sort: {sortLabels[sort] ?? "Manual"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" data-workspace-menu="">
        <DropdownMenuRadioGroup onValueChange={onSortChange} value={sort}>
          <DropdownMenuRadioItem value="manual">Manual</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dueDate">
            Due date
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="priority">
            Priority
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

export { CalendarToolbar };
