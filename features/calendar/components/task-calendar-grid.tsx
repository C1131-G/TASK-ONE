/* eslint-disable shadcn/no-inline-styles, shadcn/no-restyle, shadcn/no-unknown-classes */

"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useHydrated } from "@/components/workspace/use-hydrated";
import { eventsByLocalDay } from "@/features/calendar/calendar-event-days";
import type {
  CalendarEvent,
  CalendarTask,
} from "@/features/calendar/components/task-calendar-chips";
import { TaskCalendarDays } from "@/features/calendar/components/task-calendar-days";
import { CalendarToolbar } from "@/features/calendar/components/task-calendar-toolbar";
import { useTaskReschedule } from "@/features/tasks/hooks/use-task-reschedule";
import { datesForDueDay } from "@/features/tasks/task-dates";
import { canEditTaskRecord } from "@/features/tasks/task-permissions";
import { useSearchParamState } from "@/hooks/use-search-param-state";
import { dayKeyIn } from "@/lib/format-date";

export type {
  CalendarEvent,
  CalendarTask,
} from "@/features/calendar/components/task-calendar-chips";

const priorityOrder: Record<string, number> = {
  high: 1,
  low: 3,
  medium: 2,
  none: 4,
  urgent: 0,
};
interface CalendarProject {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}
const NO_CALENDAR_PROJECTS: readonly CalendarProject[] = [];
// Each prefix ends just before the month offset value.
export type CalendarHrefPrefix =
  `${"/calendar" | "/my-tasks" | `/projects/${string}`}?${string}`;

const NO_EMPLOYEES: readonly { readonly id: string; readonly name: string }[] =
  [];

const CALENDAR_STATUSES = [
  "all",
  "backlog",
  "todo",
  "progress",
  "review",
  "done",
] as const;
const CALENDAR_PRIORITIES = [
  "all",
  "urgent",
  "high",
  "medium",
  "low",
  "none",
] as const;
const CALENDAR_SORTS = ["manual", "dueDate", "name", "priority"] as const;

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
  readonly hrefPrefix?: CalendarHrefPrefix;
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
  const [status, setStatus] = useSearchParamState(
    "calStatus",
    CALENDAR_STATUSES,
    "all"
  );
  const [priority, setPriority] = useSearchParamState(
    "calPriority",
    CALENDAR_PRIORITIES,
    "all"
  );
  const [sort, setSort] = useSearchParamState(
    "calSort",
    CALENDAR_SORTS,
    "manual"
  );
  const navigation = hrefPrefix ?? "/calendar?monthOffset=";
  // The grid's days are UTC calendar days, matching how due dates are stored
  // and the period the server loaded. "Today" and timed events follow the
  // viewer's own zone once hydrated; the server render uses UTC so it matches.
  const viewerTimeZone = useHydrated() ? undefined : "UTC";
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
  const today = dayKeyIn(new Date(), viewerTimeZone);
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
    const task = reschedule.tasks.find(({ id }) => id === taskId);
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
  const eventByDay = eventsByLocalDay(events, viewerTimeZone);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const calendarHref = (offset: number, mode = viewMode): CalendarHrefPrefix =>
    `${navigation}${offset}&calendarMode=${mode}`;

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
                  style={{ "--c": project.color }}
                />
                {project.name}
              </li>
            ))}
          </ul>
        ) : null}
        <div aria-label="Calendar view" className="calendar-view-toggle">
          <Button
            aria-current={viewMode === "month" ? "page" : undefined}
            asChild
            size="sm"
            variant={viewMode === "month" ? "default" : "outline"}
          >
            <Link href={calendarHref(0, "month")}>Month</Link>
          </Button>
          <Button
            aria-current={viewMode === "week" ? "page" : undefined}
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
