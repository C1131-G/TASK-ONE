import {
  currentUtcMonthRange,
  currentUtcWeekRange,
} from "@/src/lib/utc-date-range";
import type { UtcDateRange } from "@/src/lib/utc-date-range";

const MAX_MONTH_OFFSET = 24;

type CalendarMode = "month" | "week";

const parseCalendarMode = (value: unknown): CalendarMode =>
  value === "week" ? "week" : "month";

// Offsets beyond two years either way are clamped; non-integers mean "now".
const parseMonthOffset = (value: unknown): number => {
  const requested = typeof value === "string" ? Number(value) : 0;
  return Number.isInteger(requested)
    ? Math.max(-MAX_MONTH_OFFSET, Math.min(MAX_MONTH_OFFSET, requested))
    : 0;
};

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});
const WEEK_LABEL_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

// Noon UTC keeps the label on the same calendar day in every time zone.
const labelDate = (day: string): Date => new Date(`${day}T12:00:00Z`);

// The visible range and its heading, derived from the URL on the server.
const calendarPeriod = (
  mode: CalendarMode,
  offset: number
): { readonly label: string; readonly range: UtcDateRange } => {
  if (mode === "week") {
    const range = currentUtcWeekRange(offset);
    return {
      label: `${WEEK_LABEL_FORMATTER.format(labelDate(range.from))} – ${WEEK_LABEL_FORMATTER.format(labelDate(range.to))}`,
      range,
    };
  }
  const range = currentUtcMonthRange(offset, 1);
  return { label: MONTH_LABEL_FORMATTER.format(labelDate(range.from)), range };
};

export { calendarPeriod, parseCalendarMode, parseMonthOffset };
export type { CalendarMode };
