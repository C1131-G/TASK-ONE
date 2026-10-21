// Pure period and burn arithmetic for project budgets. Nothing here touches
// the database, so the month and time-zone rules are testable on their own.

export type BudgetKind = "one_off" | "retainer";
export type BurnLevel = "ok" | "warning" | "overrun";

export interface BudgetPeriod {
  // Dates are company-calendar days (YYYY-MM-DD); null means unbounded.
  readonly from: string | null;
  // Stable per period; the dedupe key for alerts is built from it.
  readonly key: string;
  readonly to: string | null;
}

export interface Burn {
  readonly level: BurnLevel;
  readonly percent: number;
  // Negative once the budget is overrun.
  readonly remainingMinutes: number;
}

const ONE_OFF_KEY = "one-off";
const PERCENT = 100;
const DECEMBER = 12;
const LAST_DAY_OF_MONTH = 0;

// en-CA formats a date as YYYY-MM-DD.
export const companyToday = (at: Date, timeZone: string): string =>
  at.toLocaleDateString("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  });

const lastDayOf = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, LAST_DAY_OF_MONTH)).getUTCDate();

export const budgetPeriod = (
  kind: BudgetKind,
  now: Date,
  timeZone: string
): BudgetPeriod => {
  if (kind === "one_off") {
    return { from: null, key: ONE_OFF_KEY, to: null };
  }
  const key = companyToday(now, timeZone).slice(0, "YYYY-MM".length);
  const [year = 0, month = DECEMBER] = key.split("-").map(Number);
  return {
    from: `${key}-01`,
    key,
    to: `${key}-${String(lastDayOf(year, month)).padStart(2, "0")}`,
  };
};

export const burnOf = (input: {
  readonly budgetMinutes: number;
  readonly spentMinutes: number;
  readonly warningPercent: number;
}): Burn => {
  const { budgetMinutes, spentMinutes, warningPercent } = input;
  let level: BurnLevel = "ok";
  if (spentMinutes > budgetMinutes) {
    level = "overrun";
  } else if (spentMinutes * PERCENT >= budgetMinutes * warningPercent) {
    level = "warning";
  }
  return {
    level,
    percent: Math.round((spentMinutes * PERCENT) / budgetMinutes),
    remainingMinutes: budgetMinutes - spentMinutes,
  };
};
