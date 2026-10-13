// Date arithmetic for dragging and rescheduling. Dates are calendar days in UTC,
// so a drag never shifts a day because of the viewer's time zone.
const DAY_MS = 86_400_000;

export interface TaskSpan {
  readonly dueDate: string | null;
  readonly startDate: string | null;
}

export type DragMode = "due" | "move" | "start";

export const dayDiff = (from: string, to: string): number =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS
  );

export const addDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);

// The span after dragging one of its parts by whole days. A task with only one
// date is treated as a single-day span, so an edge drag sets the other date.
// The start never moves past the due date and the due date never moves before
// the start, which keeps the server's start-before-due rule satisfied.
export const datesAfterDrag = (
  span: TaskSpan,
  mode: DragMode,
  days: number
): TaskSpan => {
  const start = span.startDate ?? span.dueDate;
  const end = span.dueDate ?? span.startDate;
  if (!start || !end) {
    return span;
  }
  if (mode === "move") {
    return {
      dueDate: span.dueDate ? addDays(span.dueDate, days) : null,
      startDate: span.startDate ? addDays(span.startDate, days) : null,
    };
  }
  if (mode === "start") {
    const next = addDays(start, days);
    return {
      dueDate: span.dueDate,
      startDate: next > end ? end : next,
    };
  }
  const next = addDays(end, days);
  return {
    dueDate: next < start ? start : next,
    startDate: span.startDate,
  };
};

// Dropping a task on a calendar day moves its whole span so the due date lands on
// that day. Returns null for a task without a due date, which the calendar hides.
export const datesForDueDay = (span: TaskSpan, day: string): TaskSpan | null =>
  span.dueDate
    ? datesAfterDrag(span, "move", dayDiff(span.dueDate, day))
    : null;

export const sameSpan = (first: TaskSpan, second: TaskSpan): boolean =>
  first.startDate === second.startDate && first.dueDate === second.dueDate;
