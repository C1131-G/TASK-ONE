const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/u;
const MS_PER_DAY = 86_400_000;
const DEFAULT_REPORT_DAYS = 30;

type RawParam = string | string[] | undefined;

const shiftDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);

// A real YYYY-MM-DD date from a query string, or null.
export const parseDateParam = (raw?: RawParam): string | null => {
  if (typeof raw !== "string" || !DATE_SHAPE.test(raw)) {
    return null;
  }
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === raw
    ? raw
    : null;
};

// The report window: both ends from the URL, a missing start defaulting to 30
// days before the end, and a backwards range swapped.
export const projectReportRange = (
  fromRaw: RawParam,
  toRaw: RawParam,
  today: string
): { readonly from: string; readonly to: string } => {
  const to = parseDateParam(toRaw) ?? today;
  const from = parseDateParam(fromRaw) ?? shiftDays(to, -DEFAULT_REPORT_DAYS);
  return from <= to ? { from, to } : { from: to, to: from };
};
