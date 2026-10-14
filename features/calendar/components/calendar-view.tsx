/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import { connection } from "next/server";

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { WorkspaceCalendar } from "@/components/workspace/workspace-calendar";
import { calendarPeriod } from "@/features/calendar/calendar-params";
import type { CalendarMode } from "@/features/calendar/calendar-params";
import {
  listCalendarEvents,
  listTaskCalendar,
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
  await connection();
  const { label: monthLabel, range } = calendarPeriod(viewMode, monthOffset);
  const [tasks, events, session, projects, employeeResult] = await Promise.all([
    listTaskCalendar({
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
    return (
      <div className="panel panel-b" role="alert">
        Calendar could not be loaded. Refresh to retry.
      </div>
    );
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

const CalendarViewSkeleton = () => (
  <PanelSkeleton label="Loading calendar…" rows={8} />
);

export { CalendarView, CalendarViewSkeleton };
