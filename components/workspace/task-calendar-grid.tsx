/* eslint-disable shadcn/no-inline-styles, shadcn/no-restyle, shadcn/no-unknown-classes */

"use client";

import {
  ArrowsDownUp,
  CaretLeft,
  CaretRight,
  FunnelSimple,
} from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

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
import type {
  CalendarEvent,
  CalendarTask,
} from "@/components/workspace/task-calendar-chips";
import { TaskCalendarDays } from "@/components/workspace/task-calendar-days";
import { datesForDueDay } from "@/components/workspace/task-dates";
import { canEditTaskRecord } from "@/components/workspace/task-permissions";
import { useTaskReschedule } from "@/components/workspace/use-task-reschedule";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";

export type {
  CalendarEvent,
  CalendarTask,
} from "@/components/workspace/task-calendar-chips";

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);
const priorityOrder: Record<string, number> = {
  high: 1,
  low: 3,
  medium: 2,
  none: 4,
  urgent: 0,
};
const sortLabels: Record<string, string> = {
  dueDate: "Due date",
  manual: "Manual",
  name: "Name",
  priority: "Priority",
};
interface CalendarProject {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}
const NO_CALENDAR_PROJECTS: readonly CalendarProject[] = [];
const NO_EMPLOYEES: readonly { readonly id: string; readonly name: string }[] =
  [];

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

export const TaskCalendarGrid = ({
  monthOffset,
  monthLabel,
  hrefPrefix,
  tasks,
  events,
  projects = NO_CALENDAR_PROJECTS,
  employees = NO_EMPLOYEES,
  currentUserId = null,
  isAdmin = false,
  viewMode = "month",
  onAddTask,
}: {
  readonly monthOffset: number;
  readonly monthLabel: string;
  readonly hrefPrefix?: string;
  readonly tasks: readonly CalendarTask[];
  readonly events: readonly CalendarEvent[];
  readonly projects?: readonly CalendarProject[];
  readonly employees?: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly currentUserId?: string | null;
  readonly isAdmin?: boolean;
  readonly viewMode?: "month" | "week";
  readonly onAddTask?: (dueDate: string) => void;
}) => {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [sort, setSort] = useState("manual");
  const navigation = hrefPrefix ?? "/calendar?monthOffset=";
  // eslint-disable-next-line react/purity -- The workspace calendar renders request-time dates.
  const current = new Date();
  if (viewMode === "month") {
    current.setUTCDate(1);
    current.setUTCMonth(current.getUTCMonth() + monthOffset);
  } else {
    current.setUTCDate(current.getUTCDate() + monthOffset * 7);
  }
  current.setUTCHours(0, 0, 0, 0);
  const start = new Date(current);
  const firstWeekday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - firstWeekday);
  // eslint-disable-next-line react/purity -- The today marker is request-time calendar data.
  const today = dayKey(new Date());
  const days = Array.from(
    { length: viewMode === "week" ? 7 : 42 },
    (_, index) => {
      // eslint-disable-next-line react/purity -- Calendar cells derive from the requested period.
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      return date;
    }
  );
  const normalizedQuery = query.trim().toLowerCase();
  // Moves show at once and roll back if the server refuses them.
  const reschedule = useTaskReschedule(tasks);
  const moveToDay = (taskId: string, day: string) => {
    // Read the displayed task: a move made a moment ago is not in the props yet.
    const task = reschedule.tasks.find((item) => item.id === taskId);
    if (!task || !canEditTaskRecord(task, currentUserId, isAdmin)) {
      return;
    }
    const dates = datesForDueDay(task, day);
    if (dates) {
      reschedule.move(task, dates);
    }
  };
  const visibleTasks = reschedule.tasks
    .filter((task) => {
      const matchesQuery =
        !normalizedQuery ||
        `${task.title} ${task.projectName}`
          .toLowerCase()
          .includes(normalizedQuery);
      return (
        matchesQuery &&
        (status === "all" || task.status === status) &&
        (priority === "all" || task.priority === priority)
      );
    })
    .toSorted((left, right) => {
      if (sort === "name") {
        return left.title.localeCompare(right.title);
      }
      if (sort === "manual") {
        return left.position - right.position;
      }
      if (sort === "priority") {
        return (
          (priorityOrder[left.priority] ?? 5) -
          (priorityOrder[right.priority] ?? 5)
        );
      }
      return (left.dueDate ?? "9999-12-31").localeCompare(
        right.dueDate ?? "9999-12-31"
      );
    });
  const taskByDay = new Map<string, CalendarTask[]>();
  for (const task of visibleTasks) {
    if (task.dueDate) {
      const existing = taskByDay.get(task.dueDate) ?? [];
      existing.push(task);
      taskByDay.set(task.dueDate, existing);
    }
  }
  const eventByDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = dayKey(event.startsAt);
    const existing = eventByDay.get(key) ?? [];
    existing.push(event);
    eventByDay.set(key, existing);
  }
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const calendarHref = (offset: number, mode = viewMode): Route =>
    `${navigation}${offset}&calendarMode=${mode}` as Route;

  return (
    <section className="panel cal workspace-calendar">
      <CalendarToolbar
        onPriorityChange={setPriority}
        onQueryChange={setQuery}
        onSortChange={setSort}
        onStatusChange={setStatus}
        priority={priority}
        query={query}
        sort={sort}
        status={status}
      />
      <div className="toolbar calendar-navigation-toolbar">
        <Button asChild size="sm" variant="outline">
          <Link href={calendarHref(0)} prefetch={false}>
            Today
          </Link>
        </Button>
        <div className="row calendar-nav">
          <Button
            aria-label={`Previous ${viewMode}`}
            asChild
            size="icon"
            variant="ghost"
          >
            <Link href={calendarHref(monthOffset - 1)}>
              <CaretLeft aria-hidden="true" size={16} />
            </Link>
          </Button>
          <Button
            aria-label={`Next ${viewMode}`}
            asChild
            size="icon"
            variant="ghost"
          >
            <Link href={calendarHref(monthOffset + 1)}>
              <CaretRight aria-hidden="true" size={16} />
            </Link>
          </Button>
        </div>
        <h2 aria-live="polite" className="calendar-month-label">
          {monthLabel}
        </h2>
        {projects.length ? (
          <ul aria-label="Projects" className="calendar-project-legend">
            {projects.map((project) => (
              <li className="calendar-project-legend-item" key={project.id}>
                <span
                  aria-hidden="true"
                  className="pdot"
                  style={{ "--c": project.color } as React.CSSProperties}
                />
                {project.name}
              </li>
            ))}
          </ul>
        ) : null}
        <div aria-label="Calendar view" className="calendar-view-toggle">
          <Button
            aria-pressed={viewMode === "month"}
            asChild
            size="sm"
            variant={viewMode === "month" ? "default" : "outline"}
          >
            <Link href={calendarHref(0, "month")}>Month</Link>
          </Button>
          <Button
            aria-pressed={viewMode === "week"}
            asChild
            size="sm"
            variant={viewMode === "week" ? "default" : "outline"}
          >
            <Link href={calendarHref(0, "week")}>Week</Link>
          </Button>
        </div>
      </div>
      <div className="cal-h" aria-hidden="true">
        {[
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <output aria-live="polite" className="sr-only">
        {reschedule.announcement}
      </output>
      {reschedule.error ? (
        <p className="error" role="alert">
          {reschedule.error}
        </p>
      ) : null}
      <TaskCalendarDays
        currentMonth={current}
        currentUserId={currentUserId}
        days={days}
        employees={employees}
        eventByDay={eventByDay}
        isAdmin={isAdmin}
        onAddTask={onAddTask}
        onMoveTask={moveToDay}
        projectById={projectById}
        taskByDay={taskByDay}
        today={today}
      />
    </section>
  );
};
