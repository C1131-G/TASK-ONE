/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import Link from "next/link";

import { TimeEntryForm } from "@/features/time/components/time-entry-form";
import type { TaskChoice } from "@/features/time/components/time-entry-form";
import { TimeEntryList } from "@/features/time/components/time-entry-list";
import { TimerControl } from "@/features/time/components/timer-control";
import {
  formatMinutes,
  localToday,
  shiftWeek,
  weekLabel,
} from "@/features/time/time-format";
import type { RunningTimer, WeeklyTime } from "@/src/server/time/time-tracking";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const MyTimeView = ({
  currentUserId,
  isAdmin,
  taskChoices,
  timer,
  week,
}: {
  readonly currentUserId: string;
  readonly isAdmin: boolean;
  readonly taskChoices: readonly TaskChoice[];
  readonly timer: RunningTimer | null;
  readonly week: WeeklyTime;
}) => {
  const today = localToday();
  const previous = {
    pathname: "/my-time",
    query: { week: shiftWeek(week.weekStart, -1) },
  } as const;
  const next = {
    pathname: "/my-time",
    query: { week: shiftWeek(week.weekStart, 1) },
  } as const;
  return (
    <div className="stack my-time">
      <section aria-label="Timer" className="panel panel-b">
        <TimerControl taskChoices={taskChoices} timer={timer} />
      </section>
      <nav aria-label="Week" className="row my-time-weeks">
        <Link
          aria-label="Previous week"
          className="btn btn-secondary btn-sm"
          href={previous}
        >
          <CaretLeft aria-hidden="true" size={14} />
        </Link>
        <h2 className="my-time-week-label">{weekLabel(week.weekStart)}</h2>
        <Link
          aria-label="Next week"
          className="btn btn-secondary btn-sm"
          href={next}
        >
          <CaretRight aria-hidden="true" size={14} />
        </Link>
        <p className="muted my-time-week-total">
          <strong>{formatMinutes(week.totalMinutes)}</strong> this week,{" "}
          {formatMinutes(week.billableMinutes)} billable
        </p>
      </nav>
      <ol aria-label="Hours per day" className="my-time-days">
        {week.days.map((day, index) => (
          <li
            className="my-time-day"
            data-today={day.date === today || undefined}
            key={day.date}
          >
            <span className="muted">{WEEKDAYS[index]}</span>
            <time dateTime={day.date}>{day.date.slice(8)}</time>
            <strong>
              {day.minutes === 0 ? "-" : formatMinutes(day.minutes)}
            </strong>
          </li>
        ))}
      </ol>
      <section aria-label="Log time" className="panel panel-b stack">
        <h3>Log time</h3>
        <TimeEntryForm
          idPrefix="my-time"
          taskChoices={taskChoices}
          today={today}
        />
      </section>
      <section aria-label="Entries this week" className="stack">
        <h3>Entries</h3>
        <TimeEntryList
          currentUserId={currentUserId}
          entries={week.entries}
          isAdmin={isAdmin}
          showTask
          today={today}
        />
      </section>
    </div>
  );
};
