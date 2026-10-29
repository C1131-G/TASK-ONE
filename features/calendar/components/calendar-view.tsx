/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import {
  CaretLeft,
  CaretRight,
  FunnelSimple,
} from "@phosphor-icons/react/dist/ssr";
import { io } from "next/cache";

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
import { WorkspaceCalendar } from "@/components/workspace/workspace-calendar";
import { calendarPeriod } from "@/features/calendar/calendar-params";
import type { CalendarMode } from "@/features/calendar/calendar-params";
import {
  listCalendarEvents,
  listAllTaskCalendar,
} from "@/features/calendar/calendar-queries";
import { CalendarEventForm } from "@/features/calendar/components/calendar-event-form";
import { CalendarEventManager } from "@/features/calendar/components/calendar-event-manager";
import { listAllEmployees } from "@/features/people/people-queries";
import { listProjects } from "@/features/projects/projects-queries";
import { getPageSession } from "@/src/server/auth/page-session";

const CalendarView = async ({
  monthOffset,
  viewMode,
}: {
  readonly monthOffset: number;
  readonly viewMode: CalendarMode;
}) => {
  await io();
  const { label: monthLabel, range } = calendarPeriod(viewMode, monthOffset);
  const [tasks, events, session, projects, employeeResult] = await Promise.all([
    listAllTaskCalendar({
      from: range.from,
      groupBy: "none",
      limit: 200,
      priorities: [],
      sortBy: "dueDate",
      sortDirection: "asc",
      statuses: [],
      to: range.to,
    }),
    listCalendarEvents({
      from: range.fromInstant,
      to: range.toInstant,
    }),
    getPageSession(),
    listProjects({}),
    listAllEmployees(),
  ]);
  if (!tasks.ok || !events.ok) {
    throw new Error("Calendar could not be loaded.");
  }
  return (
    <>
      <WorkspaceCalendar
        events={events.data}
        employees={
          employeeResult.ok
            ? employeeResult.data.map(({ id, name }) => ({ id, name }))
            : []
        }
        monthLabel={monthLabel}
        monthOffset={monthOffset}
        currentUserId={
          session.kind === "authenticated" ? session.user.id : null
        }
        isAdmin={
          session.kind === "authenticated" && session.user.role === "admin"
        }
        projects={
          projects.ok
            ? projects.data.map(({ color, id, name }) => ({ color, id, name }))
            : []
        }
        tasks={tasks.data}
        viewMode={viewMode}
      />
      {session.kind === "authenticated" && session.user.role === "admin" ? (
        <CalendarEventForm />
      ) : null}
      <CalendarEventManager
        events={events.data}
        period={viewMode}
        isAdmin={
          session.kind === "authenticated" && session.user.role === "admin"
        }
      />
    </>
  );
};

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const CALENDAR_DAYS = SKELETON_KEYS.slice(0, 42);

// Mirrors TaskCalendarGrid: toolbar, navigation and weekday names are static;
// the month, legend and every day cell are data.
const CalendarGridSkeleton = () => (
  <section className="panel cal workspace-calendar">
    <div className="toolbar calendar-toolbar" inert>
      <span className="skeleton-filter-select skeleton-search">
        Search tasks
      </span>
      <span className="btn btn-sm btn-outline">
        <FunnelSimple aria-hidden="true" size={16} /> Filter
      </span>
      <span className="btn btn-sm btn-ghost">Sort: Manual</span>
    </div>
    <div className="toolbar calendar-navigation-toolbar" inert>
      <span className="btn btn-sm btn-outline">Today</span>
      <div className="row calendar-nav">
        <span className="ibtn">
          <CaretLeft aria-hidden="true" size={16} />
        </span>
        <span className="ibtn">
          <CaretRight aria-hidden="true" size={16} />
        </span>
      </div>
      <h2 className="calendar-month-label">
        <SkeletonBone shape="title" />
      </h2>
      <div className="calendar-project-legend skeleton-legend">
        <SkeletonBone shape="short" />
        <SkeletonBone shape="short" />
      </div>
      <div className="calendar-view-toggle">
        <span className="btn btn-sm btn-primary">Month</span>
        <span className="btn btn-sm btn-outline">Week</span>
      </div>
    </div>
    <div aria-hidden="true" className="cal-h">
      {WEEKDAYS.map((day) => (
        <div key={day}>{day}</div>
      ))}
    </div>
    <SkelterSurface label="Loading calendar…">
      <div className="cal-g workspace-calendar-grid">
        {CALENDAR_DAYS.map((key) => (
          <div className="cday" key={key}>
            <span className="dn">
              <SkeletonBone shape="short" />
            </span>
          </div>
        ))}
      </div>
    </SkelterSurface>
  </section>
);

const CalendarEventsSkeleton = () => (
  <section className="panel">
    <div className="panel-h">
      <h2>Events this month</h2>
    </div>
    <SkelterSurface label="Loading calendar events…">
      <div className="empty-state calendar-events-skeleton">
        <span aria-hidden="true" className="glyph">
          <SkeletonBone shape="avatar" />
        </span>
        <h3 className="es-h">
          <SkeletonBone shape="title" />
        </h3>
        <div className="skeleton-copy calendar-events-skeleton-copy">
          <SkeletonBone />
          <SkeletonBone />
        </div>
        <SkeletonBone shape="control" />
      </div>
    </SkelterSurface>
  </section>
);

const CalendarViewSkeleton = () => (
  <>
    <div className="ph">
      <div>
        <h1>Calendar</h1>
        <p>Deadlines and events across every project.</p>
      </div>
    </div>
    <CalendarGridSkeleton />
    <CalendarEventsSkeleton />
  </>
);

export { CalendarView, CalendarViewSkeleton };
