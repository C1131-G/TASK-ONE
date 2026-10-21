// Shared date display. Every formatter takes an optional IANA time zone; when
// it is omitted the runtime's own zone is used, which in the browser is the
// viewer's. Date-only values ("2026-10-20") are calendar days, not instants,
// so they always render on their own day whatever the zone.

const LOCALE = "en";
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/u;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

type DateInput = Date | string;

const DATE_OPTIONS = { dateStyle: "medium" } as const;
const DATE_TIME_OPTIONS = { dateStyle: "medium", timeStyle: "short" } as const;
const DAY_KEY_OPTIONS = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
} as const;

type FormatterKind = "date" | "dateTime" | "dayKey";

const FORMAT_OPTIONS = {
  date: DATE_OPTIONS,
  dateTime: DATE_TIME_OPTIONS,
  dayKey: DAY_KEY_OPTIONS,
} as const;
// en-CA writes dates as YYYY-MM-DD, the shape of a day key.
const localeFor = (kind: FormatterKind): string =>
  kind === "dayKey" ? "en-CA" : LOCALE;

// The runtime's own zone is fixed for the life of the page.
const runtimeFormatters = {
  date: new Intl.DateTimeFormat(LOCALE, DATE_OPTIONS),
  dateTime: new Intl.DateTimeFormat(LOCALE, DATE_TIME_OPTIONS),
  dayKey: new Intl.DateTimeFormat("en-CA", DAY_KEY_OPTIONS),
} as const;
const zonedFormatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (
  kind: FormatterKind,
  timeZone: string | undefined
): Intl.DateTimeFormat => {
  if (!timeZone) {
    return runtimeFormatters[kind];
  }
  const options = FORMAT_OPTIONS[kind];
  const locale = localeFor(kind);
  const cacheKey = `${kind}|${timeZone}`;
  const cached = zonedFormatters.get(cacheKey);
  if (cached) {
    return cached;
  }
  const created = new Intl.DateTimeFormat(locale, { ...options, timeZone });
  zonedFormatters.set(cacheKey, created);
  return created;
};

const isDateOnly = (value: DateInput): value is string =>
  typeof value === "string" && DATE_ONLY.test(value);

const toInstant = (value: DateInput): Date | undefined => {
  const date = isDateOnly(value)
    ? new Date(`${value}T00:00:00.000Z`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

// "2026-10-20" for the calendar day an instant falls on in the given zone.
const dayKeyIn = (instant: Date, timeZone?: string): string => {
  const parts = formatterFor("dayKey", timeZone).formatToParts(instant);
  const part = (type: "year" | "month" | "day") =>
    parts.find((datePart) => datePart.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

// "Oct 20, 2026"
const formatDate = (value: DateInput, timeZone?: string): string => {
  const instant = toInstant(value);
  if (!instant) {
    return "";
  }
  const zone = isDateOnly(value) ? "UTC" : timeZone;
  return formatterFor("date", zone).format(instant);
};

// "Oct 20, 2026, 7:30 AM"
const formatDateTime = (value: DateInput, timeZone?: string): string => {
  const instant = toInstant(value);
  return instant ? formatterFor("dateTime", timeZone).format(instant) : "";
};

const relativeFormatter = new Intl.RelativeTimeFormat(LOCALE, {
  numeric: "auto",
});

// "5 minutes ago", "yesterday", "in 2 hours"; older than a week reads as a date.
const formatRelative = (
  value: DateInput,
  now: Date,
  timeZone?: string
): string => {
  const instant = toInstant(value);
  if (!instant) {
    return "";
  }
  const elapsed = instant.getTime() - now.getTime();
  const distance = Math.abs(elapsed);
  if (distance < MINUTE_MS) {
    return "just now";
  }
  if (distance < HOUR_MS) {
    return relativeFormatter.format(Math.round(elapsed / MINUTE_MS), "minute");
  }
  if (distance < DAY_MS) {
    return relativeFormatter.format(Math.round(elapsed / HOUR_MS), "hour");
  }
  if (distance < WEEK_MS) {
    return relativeFormatter.format(Math.round(elapsed / DAY_MS), "day");
  }
  return formatDate(instant, timeZone);
};

export { dayKeyIn, formatDate, formatDateTime, formatRelative };
export type { DateInput };
