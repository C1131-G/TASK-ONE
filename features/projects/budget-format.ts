import type { BurnLevel } from "@/src/server/budgets/budget-math";

// Pure display helpers for project budgets.

const MINUTES_PER_HOUR = 60;
const CENTS_PER_UNIT = 100;
const FULL_BAR = 100;
const HOUR_DECIMALS = 100;
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
const MONTH_KEY = /^(?<year>\d{4})-(?<month>\d{2})$/u;
const RATE_TEXT = /^\d+(?:\.\d{1,2})?$/u;

export const hoursToMinutes = (hours: number): number =>
  Math.max(1, Math.round(hours * MINUTES_PER_HOUR));

// Whole or two-decimal hours without trailing zeros.
export const minutesToHours = (minutes: number): string =>
  String(
    Math.round((minutes / MINUTES_PER_HOUR) * HOUR_DECIMALS) / HOUR_DECIMALS
  );

export const formatMoney = (cents: number, currency: string): string =>
  new Intl.NumberFormat("en-US", { currency, style: "currency" }).format(
    cents / CENTS_PER_UNIT
  );

export const parseRateToCents = (
  text: string
):
  | { readonly cents: number | null; readonly ok: true }
  | { readonly ok: false } => {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { cents: null, ok: true };
  }
  return RATE_TEXT.test(trimmed)
    ? { cents: Math.round(Number(trimmed) * CENTS_PER_UNIT), ok: true }
    : { ok: false };
};

export const periodLabel = (key: string): string => {
  const parts = MONTH_KEY.exec(key)?.groups;
  const month = parts ? MONTHS[Number(parts["month"]) - 1] : undefined;
  return parts && month ? `${month} ${parts["year"]}` : "All time";
};

export const levelLabel = (level: BurnLevel): string => {
  if (level === "overrun") {
    return "Over budget";
  }
  return level === "warning" ? "Near the limit" : "On track";
};

export const barWidth = (percent: number): number =>
  Math.min(FULL_BAR, Math.max(0, percent));
