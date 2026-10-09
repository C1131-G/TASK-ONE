/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { connection } from "next/server";

import { listCalendarEventsAction } from "@/app/actions/calendar";
import { listTaskCalendarAction } from "@/app/actions/task-calendar";
import { CalendarEventForm } from "@/components/workspace/calendar-event-form";
import { CalendarEventManager } from "@/components/workspace/calendar-event-manager";
import { TaskCalendarGrid } from "@/components/workspace/task-calendar-grid";
import { currentUtcMonthRange } from "@/src/lib/utc-date-range";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "Calendar | Metsys" };

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

const CalendarPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly monthOffset?: string }>;
}) => {
  await connection();
  const params = await searchParams;
  const requestedOffset = Number(params.monthOffset ?? 0);
  const monthOffset = Number.isInteger(requestedOffset)
    ? Math.max(-24, Math.min(24, requestedOffset))
    : 0;
  const range = currentUtcMonthRange(monthOffset, 1);
  const [tasks, events, session] = await Promise.all([
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
  const monthLabel = MONTH_LABEL_FORMATTER.format(
    new Date(`${range.from}T12:00:00Z`)
  );
  return (
    <div className="page">
      <div className="ph">
        <div>
          <h1>Calendar</h1>
          <p>Deadlines and events across every project.</p>
        </div>
      </div>
      {session.kind === "authenticated" && session.user.role === "admin" ? (
        <CalendarEventForm />
      ) : null}
      <TaskCalendarGrid
        events={events.data}
        monthLabel={monthLabel}
        monthOffset={monthOffset}
        tasks={tasks.data}
      />
      <CalendarEventManager
        events={events.data}
        isAdmin={
          session.kind === "authenticated" && session.user.role === "admin"
        }
      />
    </div>
  );
};

export default CalendarPage;
