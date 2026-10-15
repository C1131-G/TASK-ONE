// Business-hours arithmetic for SLA clocks. A business calendar is a set of
// weekdays plus one daily window in a time zone; time outside it does not
// count. The window cannot span midnight.

export interface BusinessCalendar {
  // 0 is Sunday through 6 is Saturday.
  readonly days: readonly number[];
  readonly startMinute: number;
  readonly endMinute: number;
  readonly timeZone: string;
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
// A deadline further out than this is treated as unreachable.
const MAX_DAYS = 3660;

interface LocalDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  const cached = formatters.get(timeZone);
  if (cached) {
    return cached;
  }
  const created = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
    minute: "numeric",
    month: "numeric",
    second: "numeric",
    timeZone,
    year: "numeric",
  });
  formatters.set(timeZone, created);
  return created;
};

// The wall-clock reading of an instant in a zone, as if it were UTC.
const wallClockAsUtc = (instant: number, timeZone: string): number => {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(new Date(instant))) {
    if (part.type !== "literal") {
      parts[part.type] = Number(part.value);
    }
  }
  return Date.UTC(
    parts["year"] ?? 1970,
    (parts["month"] ?? 1) - 1,
    parts["day"] ?? 1,
    parts["hour"] ?? 0,
    parts["minute"] ?? 0,
    parts["second"] ?? 0
  );
};

const localDateOf = (instant: number, timeZone: string): LocalDate => {
  const wall = new Date(wallClockAsUtc(instant, timeZone));
  return {
    day: wall.getUTCDate(),
    month: wall.getUTCMonth() + 1,
    year: wall.getUTCFullYear(),
  };
};

const addDays = (date: LocalDate, days: number): LocalDate => {
  const moved = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    day: moved.getUTCDate(),
    month: moved.getUTCMonth() + 1,
    year: moved.getUTCFullYear(),
  };
};

const weekdayOf = (date: LocalDate): number =>
  new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();

// The instant at which a zone's wall clock reads the given minute of a date.
// A wall time skipped by a clock change resolves to just after the change.
const instantAt = (
  date: LocalDate,
  minuteOfDay: number,
  timeZone: string
): number => {
  const wall = Date.UTC(date.year, date.month - 1, date.day, 0, minuteOfDay);
  const firstGuess = wall - (wallClockAsUtc(wall, timeZone) - wall);
  const secondOffset = wallClockAsUtc(firstGuess, timeZone) - firstGuess;
  return wall - secondOffset;
};

interface Window {
  readonly start: number;
  readonly end: number;
}

const windowOf = (
  date: LocalDate,
  calendar: BusinessCalendar
): Window | null => {
  if (!calendar.days.includes(weekdayOf(date))) {
    return null;
  }
  return {
    end: instantAt(date, calendar.endMinute, calendar.timeZone),
    start: instantAt(date, calendar.startMinute, calendar.timeZone),
  };
};

// Business milliseconds between two instants; negative when `to` is earlier.
export const businessElapsedMs = (
  from: Date,
  to: Date,
  calendar: BusinessCalendar
): number => {
  if (to.getTime() < from.getTime()) {
    return -businessElapsedMs(to, from, calendar);
  }
  const first = from.getTime();
  const last = to.getTime();
  const lastDate = localDateOf(last, calendar.timeZone);
  let date = localDateOf(first, calendar.timeZone);
  let total = 0;
  for (let step = 0; step <= MAX_DAYS; step += 1) {
    const window = windowOf(date, calendar);
    if (window) {
      const overlap =
        Math.min(last, window.end) - Math.max(first, window.start);
      if (overlap > 0) {
        total += overlap;
      }
    }
    if (
      date.year === lastDate.year &&
      date.month === lastDate.month &&
      date.day === lastDate.day
    ) {
      break;
    }
    date = addDays(date, 1);
  }
  return total;
};

// The instant at which `minutes` of business time have passed since `start`.
export const businessDeadline = (
  start: Date,
  minutes: number,
  calendar: BusinessCalendar
): Date => {
  if (minutes <= 0) {
    return new Date(start);
  }
  if (calendar.days.length === 0) {
    return new Date(start.getTime() + minutes * MINUTE_MS);
  }
  let remaining = minutes * MINUTE_MS;
  let date = localDateOf(start.getTime(), calendar.timeZone);
  for (let step = 0; step <= MAX_DAYS; step += 1) {
    const window = windowOf(date, calendar);
    if (window) {
      const cursor = Math.max(start.getTime(), window.start);
      const available = window.end - cursor;
      if (available > 0) {
        if (remaining <= available) {
          return new Date(cursor + remaining);
        }
        remaining -= available;
      }
    }
    date = addDays(date, 1);
  }
  return new Date(start.getTime() + MAX_DAYS * DAY_MS);
};
