/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { connection } from "next/server";

import { listCalendarEventsAction } from "@/app/actions/calendar";
import { listEmployeesAction } from "@/app/actions/employees";
import { listProjectsAction } from "@/app/actions/projects";
import { listTaskCalendarAction } from "@/app/actions/task-calendar";
import { CalendarEventForm } from "@/components/workspace/calendar-event-form";
import { CalendarEventManager } from "@/components/workspace/calendar-event-manager";
import { WorkspaceCalendar } from "@/components/workspace/workspace-calendar";
import {
  currentUtcMonthRange,
  currentUtcWeekRange,
} from "@/src/lib/utc-date-range";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "Calendar | Metsys" };

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});
const WEEK_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const CalendarPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<{
    readonly calendarMode?: string;
    readonly monthOffset?: string;
  }>;
}) => {
  await connection();
  const params = await searchParams;
  const requestedOffset = Number(params.monthOffset ?? 0);
  const monthOffset = Number.isInteger(requestedOffset)
    ? Math.max(-24, Math.min(24, requestedOffset))
    : 0;
  const viewMode = params.calendarMode === "week" ? "week" : "month";
  const range =
    viewMode === "week"
      ? currentUtcWeekRange(monthOffset)
      : currentUtcMonthRange(monthOffset, 1);
  const [tasks, events, session, projects, employeeResult] = await Promise.all([
    listTaskCalendarAction({
      from: range.from,
      groupBy: "none",
      limit: 200,
      priorities: [],
      sortBy: "dueDate",
      sortDirection: "asc",
      statuses: [],
      to: range.to,
    }),
    listCalendarEventsAction({
      from: range.fromInstant,
      to: range.toInstant,
    }),
    getPageSession(),
    listProjectsAction({}),
    listEmployeesAction({ search: "" }),
  ]);
  if (!tasks.ok || !events.ok) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Calendar could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }
  const monthLabel =
    viewMode === "week"
      ? `${WEEK_DATE_FORMATTER.format(new Date(`${range.from}T12:00:00Z`))} – ${WEEK_DATE_FORMATTER.format(new Date(`${range.to}T12:00:00Z`))}`
      : MONTH_LABEL_FORMATTER.format(new Date(`${range.from}T12:00:00Z`));
  return (
    <div className="page">
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
    </div>
  );
};

export default CalendarPage;
