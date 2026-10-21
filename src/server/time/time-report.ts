import { formatCsv } from "../tasks/csv";

// Pure helpers for the weekly view and the project report. Nothing here
// touches the database.

const MS_PER_DAY = 86_400_000;
const DAYS_IN_WEEK = 7;
const MONDAY_OFFSET = 6;

export interface TimeEntryView {
  readonly billable: boolean;
  readonly id: string;
  readonly minutes: number;
  readonly note: string | null;
  readonly taskId: string;
  readonly taskReference: string;
  readonly taskTitle: string;
  readonly userId: string;
  readonly userName: string;
  readonly workDate: string;
}

export interface TimeTotals {
  readonly billableMinutes: number;
  readonly totalMinutes: number;
}

export interface PersonTotals extends TimeTotals {
  readonly name: string;
  readonly userId: string;
}

export interface TaskTotals extends TimeTotals {
  readonly taskId: string;
  readonly taskReference: string;
  readonly taskTitle: string;
}

export interface ProjectTimeReport extends TimeTotals {
  readonly byPerson: readonly PersonTotals[];
  readonly byTask: readonly TaskTotals[];
  readonly from: string;
  readonly nonBillableMinutes: number;
  readonly to: string;
}

const toUtcDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const toDateString = (date: Date): string => date.toISOString().slice(0, 10);

export const addDays = (value: string, days: number): string =>
  toDateString(new Date(toUtcDate(value).getTime() + days * MS_PER_DAY));

// The Monday of the week that contains the date.
export const weekStartOf = (value: string): string =>
  addDays(
    value,
    -((toUtcDate(value).getUTCDay() + MONDAY_OFFSET) % DAYS_IN_WEEK)
  );

export const weekDates = (weekStart: string): readonly string[] =>
  Array.from({ length: DAYS_IN_WEEK }, (_unused, offset) =>
    addDays(weekStart, offset)
  );

export const sumMinutes = (entries: readonly TimeEntryView[]): TimeTotals => ({
  billableMinutes: entries.reduce(
    (sum, entry) => sum + (entry.billable ? entry.minutes : 0),
    0
  ),
  totalMinutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
});

const groupTotals = <Key extends string>(
  entries: readonly TimeEntryView[],
  keyOf: (entry: TimeEntryView) => Key
): ReadonlyMap<Key, readonly TimeEntryView[]> => {
  const groups = new Map<Key, TimeEntryView[]>();
  for (const entry of entries) {
    const key = keyOf(entry);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return groups;
};

const byMostTime = <Row extends TimeTotals>(rows: Row[]): Row[] =>
  rows.toSorted((left, right) => right.totalMinutes - left.totalMinutes);

export const buildProjectReport = (
  entries: readonly TimeEntryView[],
  range: { readonly from: string; readonly to: string }
): ProjectTimeReport => {
  const totals = sumMinutes(entries);
  const byPerson = [...groupTotals(entries, (entry) => entry.userId)].map(
    ([userId, rows]) => ({
      ...sumMinutes(rows),
      name: rows[0]?.userName ?? "",
      userId,
    })
  );
  const byTask = [...groupTotals(entries, (entry) => entry.taskId)].map(
    ([taskId, rows]) => ({
      ...sumMinutes(rows),
      taskId,
      taskReference: rows[0]?.taskReference ?? "",
      taskTitle: rows[0]?.taskTitle ?? "",
    })
  );
  return {
    ...totals,
    byPerson: byMostTime(byPerson).toSorted(
      (left, right) =>
        right.totalMinutes - left.totalMinutes ||
        left.name.localeCompare(right.name)
    ),
    byTask: byMostTime(byTask),
    from: range.from,
    nonBillableMinutes: totals.totalMinutes - totals.billableMinutes,
    to: range.to,
  };
};

export const formatTimeCsv = (entries: readonly TimeEntryView[]): string =>
  formatCsv([
    ["date", "person", "task", "minutes", "billable", "note"],
    ...entries
      .toSorted(
        (left, right) =>
          left.workDate.localeCompare(right.workDate) ||
          left.userName.localeCompare(right.userName)
      )
      .map((entry) => [
        entry.workDate,
        entry.userName,
        entry.taskTitle,
        entry.minutes,
        entry.billable ? "yes" : "no",
        entry.note,
      ]),
  ]);
