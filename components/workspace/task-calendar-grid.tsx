/* eslint-disable shadcn/no-unknown-classes */

import type { Route } from "next";
import Link from "next/link";

interface CalendarTask {
  readonly id: string;
  readonly title: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly dueDate: string | null;
  readonly status: string;
  readonly priority: string;
}

interface CalendarEvent {
  readonly id: string;
  readonly title: string;
  readonly startsAt: Date;
}

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

export const TaskCalendarGrid = ({
  monthOffset,
  monthLabel,
  hrefPrefix,
  tasks,
  events,
}: {
  readonly monthOffset: number;
  readonly monthLabel: string;
  readonly hrefPrefix?: string;
  readonly tasks: readonly CalendarTask[];
  readonly events: readonly CalendarEvent[];
}) => {
  const navigation = hrefPrefix ?? "/calendar?monthOffset=";
  // eslint-disable-next-line react/purity -- The workspace calendar renders request-time dates.
  const current = new Date();
  current.setUTCDate(1);
  current.setUTCHours(0, 0, 0, 0);
  current.setUTCMonth(current.getUTCMonth() + monthOffset);
  const start = new Date(current);
  const weekOffset = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - weekOffset);
  // eslint-disable-next-line react/purity -- The today marker is request-time calendar data.
  const today = dayKey(new Date());
  const days = Array.from({ length: 42 }, (_, index) => {
    // eslint-disable-next-line react/purity -- Calendar cells derive from the requested current month.
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date;
  });
  const taskByDay = new Map<string, CalendarTask[]>();
  for (const task of tasks) {
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

  return (
    <section className="panel cal workspace-calendar">
      <div className="toolbar">
        <Link
          className="btn btn-secondary btn-sm"
          href={`${navigation}0` as Route}
          prefetch={false}
        >
          Today
        </Link>
        <div className="row calendar-nav">
          <Link
            aria-label="Previous month"
            className="ibtn ibtn-sm"
            href={`${navigation}${monthOffset - 1}` as Route}
          >
            ‹
          </Link>
          <Link
            aria-label="Next month"
            className="ibtn ibtn-sm"
            href={`${navigation}${monthOffset + 1}` as Route}
          >
            ›
          </Link>
        </div>
        <h2 aria-live="polite" className="calendar-month-label">
          {monthLabel}
        </h2>
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
      <div className="cal-g workspace-calendar-grid">
        {days.map((date) => {
          const key = dayKey(date);
          const dayTasks = taskByDay.get(key) ?? [];
          const dayEvents = eventByDay.get(key) ?? [];
          const isCurrentMonth = date.getUTCMonth() === current.getUTCMonth();
          return (
            <div
              className={`cday${isCurrentMonth ? "" : " out"}${key === today ? " today" : ""}`}
              key={key}
            >
              <span
                aria-current={key === today ? "date" : undefined}
                className="dn"
              >
                {date.getUTCDate()}
              </span>
              {dayEvents.slice(0, 2).map((event) => (
                <div className="cev event" key={event.id} title={event.title}>
                  <span className="trunc">{event.title}</span>
                </div>
              ))}
              {dayTasks
                .slice(0, 3 - Math.min(dayEvents.length, 2))
                .map((task) => (
                  <Link
                    className={`cev${task.status === "done" ? " done" : ""}`}
                    href={`/projects/${task.projectId}?view=board` as Route}
                    key={task.id}
                    title={`${task.title} · ${task.projectName}`}
                  >
                    <span aria-hidden="true" className="pdot" />
                    <span className="trunc">{task.title}</span>
                  </Link>
                ))}
              {dayTasks.length + dayEvents.length > 3 ? (
                <span className="cmore">
                  +{dayTasks.length + dayEvents.length - 3} more
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
};
