/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */

import type { Route } from "next";
import Link from "next/link";

interface TimelineTask {
  readonly id: string;
  readonly title: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly startDate: string | null;
  readonly dueDate: string | null;
  readonly status: string;
}

const DAY_WIDTH = 11;
const ROW_HEIGHT = 36;
const DAY_MS = 86_400_000;
const MONTH_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "short",
  timeZone: "UTC",
});

const getOffset = (value: string, start: number): number =>
  Math.round((Date.parse(`${value}T00:00:00Z`) - start) / DAY_MS);

export const WorkspaceTimeline = ({
  from,
  to,
  tasks,
}: {
  readonly from: string;
  readonly to: string;
  readonly tasks: readonly TimelineTask[];
}) => {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  const dayCount = Math.max(1, Math.ceil((end - start) / DAY_MS) + 1);
  const width = dayCount * DAY_WIDTH;
  const days: Date[] = [];
  for (let index = 0; index < dayCount; index += 7) {
    // eslint-disable-next-line react/purity -- Timeline dates are derived from the requested server range.
    days.push(new Date(start + index * DAY_MS));
  }
  const months = new Map<string, { readonly label: string; width: number }>();
  for (let index = 0; index < dayCount; index += 1) {
    // eslint-disable-next-line react/purity -- Timeline dates are derived from the requested server range.
    const date = new Date(start + index * DAY_MS);
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    const month = months.get(key);
    if (month) {
      month.width += DAY_WIDTH;
    } else {
      months.set(key, {
        label: MONTH_FORMATTER.format(date),
        width: DAY_WIDTH,
      });
    }
  }
  // eslint-disable-next-line react/purity -- The today marker is request-time timeline data.
  const today = Math.round((Date.now() - start) / DAY_MS);

  return (
    <section className="panel timeline-panel">
      <div className="panel-h">
        <h2>Work timeline</h2>
      </div>
      {tasks.length ? (
        <div className="tl workspace-timeline">
          <div className="tl-left">
            <div className="tl-head">Task</div>
            <div className="tl-rows">
              {tasks.map((task) => (
                <Link
                  className="tl-row"
                  href={`/projects/${task.projectId}?view=board` as Route}
                  key={task.id}
                >
                  <span className="trunc grow">{task.title}</span>
                  <span className="faint">{task.projectName}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="tl-right">
            <div className="tl-head" style={{ width }}>
              <div className="tl-months">
                {[...months.entries()].map(([key, month]) => (
                  <div key={key} style={{ width: month.width }}>
                    <span>{month.label}</span>
                  </div>
                ))}
              </div>
              <div className="tl-days">
                {days.map((date) => (
                  <div
                    key={date.toISOString()}
                    style={{ width: DAY_WIDTH * 7 }}
                  >{`${date.getUTCMonth() + 1}/${date.getUTCDate()}`}</div>
                ))}
              </div>
            </div>
            <div
              className="tl-grid"
              style={{ height: tasks.length * ROW_HEIGHT, width }}
            >
              {days.map((date, index) => (
                <div
                  className="tl-gl"
                  key={date.toISOString()}
                  style={{ left: index * DAY_WIDTH * 7 }}
                />
              ))}
              {today >= 0 && today < dayCount ? (
                <div className="tl-today" style={{ left: today * DAY_WIDTH }} />
              ) : null}
              {tasks.map((task, index) => {
                const taskStart = task.startDate ?? task.dueDate;
                const taskEnd = task.dueDate ?? task.startDate;
                if (!taskStart || !taskEnd) {
                  return (
                    <div
                      className="tl-rowbg"
                      key={task.id}
                      style={{ top: index * ROW_HEIGHT }}
                    />
                  );
                }
                const rawStart = getOffset(taskStart, start);
                const rawEnd = getOffset(taskEnd, start);
                const left = Math.max(0, rawStart) * DAY_WIDTH;
                const right = Math.min(dayCount - 1, rawEnd);
                const barWidth = Math.max(
                  DAY_WIDTH,
                  (right - Math.max(0, rawStart) + 1) * DAY_WIDTH
                );
                return (
                  <div
                    className="tl-rowbg"
                    key={task.id}
                    style={{ top: index * ROW_HEIGHT }}
                  >
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
                        } as React.CSSProperties
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
      ) : (
        <div className="panel-b muted">
          Give tasks a start or due date to see them on the timeline.
        </div>
      )}
    </section>
  );
};
