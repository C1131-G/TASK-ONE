/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */

import type { Route } from "next";
import Link from "next/link";
import type { CSSProperties, RefObject } from "react";

import type { TimelineRow, TimelineScale } from "./workspace-timeline-types";

const DAY_MS = 86_400_000;
const ROW_HEIGHT = 36;
const MONTH_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});
const WEEK_DAY_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const DAY_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  timeZone: "UTC",
});

const getOffset = (value: string, start: number): number =>
  Math.round((Date.parse(`${value}T00:00:00Z`) - start) / DAY_MS);

export const WorkspaceTimelineChart = ({
  from,
  dayCount,
  dayWidth,
  rows,
  scale,
  today,
  viewportRef,
}: {
  readonly from: string;
  readonly dayCount: number;
  readonly dayWidth: number;
  readonly rows: readonly TimelineRow[];
  readonly scale: TimelineScale;
  readonly today: number;
  readonly viewportRef: RefObject<HTMLDivElement | null>;
}) => {
  const start = Date.parse(`${from}T00:00:00Z`);
  const width = dayCount * dayWidth;
  const tickInterval = scale === "week" ? 1 : 7;
  const dateTicks: Date[] = [];
  for (let index = 0; index < dayCount; index += tickInterval) {
    dateTicks.push(new Date(start + index * DAY_MS));
  }
  const monthWidths = new Map<string, { label: string; width: number }>();
  for (let index = 0; index < dayCount; index += 1) {
    const date = new Date(start + index * DAY_MS);
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    const month = monthWidths.get(key);
    if (month) {
      month.width += dayWidth;
    } else {
      monthWidths.set(key, {
        label: MONTH_FORMATTER.format(date),
        width: dayWidth,
      });
    }
  }

  return (
    <div className="tl workspace-timeline">
      <div className="tl-left">
        <div className="tl-head">Task</div>
        <ul aria-label="Timeline tasks" className="tl-rows">
          {rows.map((row) =>
            row.type === "group" ? (
              <li className="tl-row g" key={row.key}>
                {row.label}
              </li>
            ) : (
              <li className="tl-row" key={row.key}>
                <Link
                  className="timeline-row-link"
                  href={`/projects/${row.task.projectId}?view=board` as Route}
                >
                  <span className="trunc grow">{row.task.title}</span>
                  <span className="faint">{row.task.projectName}</span>
                </Link>
              </li>
            )
          )}
        </ul>
      </div>
      <div className="tl-right" ref={viewportRef}>
        <div className="tl-head" style={{ width }}>
          <div className="tl-months">
            {[...monthWidths.entries()].map(([key, month]) => (
              <div key={key} style={{ width: month.width }}>
                <span>{month.label}</span>
              </div>
            ))}
          </div>
          <div className="tl-days">
            {dateTicks.map((date) => {
              const offset = getOffset(date.toISOString().slice(0, 10), start);
              const tickDays = Math.min(tickInterval, dayCount - offset);
              return (
                <div
                  className={offset === today ? "today" : undefined}
                  key={date.toISOString()}
                  style={{ width: dayWidth * tickDays }}
                >
                  {scale === "week"
                    ? WEEK_DAY_FORMATTER.format(date)
                    : DAY_FORMATTER.format(date)}
                </div>
              );
            })}
          </div>
        </div>
        <div
          className="tl-grid"
          style={{ height: rows.length * ROW_HEIGHT, width }}
        >
          {dateTicks.map((date) => (
            <div
              className="tl-gl"
              key={date.toISOString()}
              style={{
                left:
                  getOffset(date.toISOString().slice(0, 10), start) * dayWidth,
              }}
            />
          ))}
          {today >= 0 && today < dayCount ? (
            <div className="tl-today" style={{ left: today * dayWidth }} />
          ) : null}
          {rows.map((row, index) => {
            const top = index * ROW_HEIGHT;
            if (row.type === "group") {
              return (
                <div className="tl-rowbg g" key={row.key} style={{ top }} />
              );
            }
            const { task } = row;
            const taskStart = task.startDate ?? task.dueDate;
            const taskEnd = task.dueDate ?? task.startDate;
            if (!taskStart || !taskEnd) {
              return <div className="tl-rowbg" key={task.id} style={{ top }} />;
            }
            const rawStart = getOffset(taskStart, start);
            const rawEnd = getOffset(taskEnd, start);
            if (rawEnd < 0 || rawStart >= dayCount) {
              return <div className="tl-rowbg" key={task.id} style={{ top }} />;
            }
            const clippedStart = Math.max(0, rawStart);
            const clippedEnd = Math.min(dayCount - 1, rawEnd);
            const left = clippedStart * dayWidth;
            const barWidth = Math.max(
              dayWidth,
              (clippedEnd - clippedStart + 1) * dayWidth
            );
            return (
              <div className="tl-rowbg" key={task.id} style={{ top }}>
                <Link
                  aria-label={`${task.title}, ${taskStart} to ${taskEnd}`}
                  className={`bar${task.status === "done" ? " done" : ""}`}
                  href={`/projects/${task.projectId}?view=board` as Route}
                  style={
                    {
                      "--c": "var(--accent)",
                      left,
                      top: 6,
                      width: barWidth,
                    } as CSSProperties
                  }
                  title={`${task.title} · ${taskStart} → ${taskEnd}`}
                >
                  <span className="trunc">{task.title}</span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
