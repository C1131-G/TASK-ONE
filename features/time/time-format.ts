const MINUTES_PER_HOUR = 60;
const MAX_ENTRY_MINUTES = 1440;
const MS_PER_DAY = 86_400_000;
const DAYS_IN_WEEK = 7;
const LAST_DAY_OFFSET = 6;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const PLAIN_MINUTES = /^\d+$/u;
const CLOCK = /^\d+:\d{1,2}$/u;
const DECIMAL_HOURS = /^\d+(?:\.\d+)?h$/u;
const HOURS_AND_MINUTES = /^(?:\d+h)?\s*(?:\d+m)?$/u;
const HOUR_PART = /\d+(?=h)/u;
const MINUTE_PART = /\d+(?=m)/u;

export const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (hours === 0) {
    return `${rest}m`;
  }
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
};

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = MINUTES_PER_HOUR * SECONDS_PER_MINUTE;
const pad = (value: number): string => String(value).padStart(2, "0");

// Elapsed seconds as HH:MM:SS, for a running timer.
export const formatClock = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor(
    (totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE
  );
  return `${pad(hours)}:${pad(minutes)}:${pad(totalSeconds % SECONDS_PER_MINUTE)}`;
};

const readMinutes = (text: string): number | null => {
  if (PLAIN_MINUTES.test(text)) {
    return Number(text);
  }
  if (CLOCK.test(text)) {
    const [hours, minutes] = text.split(":").map(Number);
    return (minutes ?? 0) < MINUTES_PER_HOUR
      ? (hours ?? 0) * MINUTES_PER_HOUR + (minutes ?? 0)
      : null;
  }
  if (DECIMAL_HOURS.test(text)) {
    return Math.round(Number(text.slice(0, -1)) * MINUTES_PER_HOUR);
  }
  if (text !== "" && HOURS_AND_MINUTES.test(text)) {
    return (
      Number(HOUR_PART.exec(text)?.[0] ?? 0) * MINUTES_PER_HOUR +
      Number(MINUTE_PART.exec(text)?.[0] ?? 0)
    );
  }
  return null;
};

// Whole minutes between 1 and one day, or null when the text is not a duration.
export const parseDuration = (input: string): number | null => {
  const minutes = readMinutes(input.trim().toLowerCase());
  return minutes !== null && minutes >= 1 && minutes <= MAX_ENTRY_MINUTES
    ? minutes
    : null;
};

const TODAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

// Today's date in the viewer's own time zone, as YYYY-MM-DD.
export const localToday = (): string => TODAY_FORMATTER.format(new Date());

const toUtc = (date: string): Date => new Date(`${date}T00:00:00.000Z`);

export const shiftWeek = (weekStart: string, weeks: number): string =>
  new Date(toUtc(weekStart).getTime() + weeks * DAYS_IN_WEEK * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);

const dayLabel = (date: Date, withYear: boolean): string =>
  `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}${withYear ? ` ${date.getUTCFullYear()}` : ""}`;

export const weekLabel = (weekStart: string): string => {
  const first = toUtc(weekStart);
  const last = new Date(first.getTime() + LAST_DAY_OFFSET * MS_PER_DAY);
  const sameYear = first.getUTCFullYear() === last.getUTCFullYear();
  return `${dayLabel(first, !sameYear)} - ${dayLabel(last, true)}`;
};
