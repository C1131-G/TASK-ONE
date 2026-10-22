// Pure workload aggregation: no database, no clock. Callers pass the company's
// calendar day and the already-loaded tasks.

// The weekly threshold above which a person is flagged as overloaded.
export const WEEKLY_CAPACITY_HOURS = 30;
export const WORKLOAD_WEEKS = 8;

const HOURS_PER_DAY = 8;
const HOURS_PER_WEEK = 40;
const MINUTES_PER_HOUR = 60;
const DAYS_PER_WEEK = 7;
const DAY_MS = 86_400_000;
const ESTIMATE_PART = /\d+(?:\.\d+)?\s*[a-z]*/giu;
const LEADING_NUMBER = /^[\d.\s]+/u;

// Tasks with no readable estimate count as this many hours by priority.
const PRIORITY_HOURS: Readonly<Record<string, number>> = {
  high: 4,
  low: 2,
  medium: 3,
  none: 2,
  urgent: 6,
};
const FALLBACK_HOURS = 2;

const unitHours = (unit: string): number | null => {
  if (unit === "") {
    return 1;
  }
  if (unit.startsWith("w")) {
    return HOURS_PER_WEEK;
  }
  if (unit.startsWith("d")) {
    return HOURS_PER_DAY;
  }
  if (unit.startsWith("h")) {
    return 1;
  }
  if (unit.startsWith("m")) {
    return 1 / MINUTES_PER_HOUR;
  }
  return null;
};

const roundHours = (hours: number): number => Math.round(hours * 10) / 10;

// Estimates are free text such as "4h", "2 days" or "1h 30m"; a bare number is
// hours.
export const estimateHours = (
  estimate: string | null,
  priority: string
): number => {
  let total = 0;
  let matched = false;
  for (const [part] of (estimate ?? "").matchAll(ESTIMATE_PART)) {
    const unit = part.replace(LEADING_NUMBER, "").toLowerCase();
    const factor = unitHours(unit);
    if (factor !== null) {
      total += Number(part.slice(0, part.length - unit.length)) * factor;
      matched = true;
    }
  }
  return matched
    ? roundHours(total)
    : (PRIORITY_HOURS[priority] ?? FALLBACK_HOURS);
};

const toUtcMs = (date: string): number => Date.parse(`${date}T00:00:00Z`);
const toDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

// Mondays, starting with the week that contains `today`.
export const weekStartsFrom = (today: string, count: number): string[] => {
  const todayMs = toUtcMs(today);
  const sinceMonday = (new Date(todayMs).getUTCDay() + 6) % DAYS_PER_WEEK;
  const first = todayMs - sinceMonday * DAY_MS;
  return Array.from({ length: count }, (_, index) =>
    toDate(first + index * DAYS_PER_WEEK * DAY_MS)
  );
};

export interface WorkloadTask {
  readonly assigneeIds: readonly string[];
  readonly dueDate: string | null;
  readonly estimate: string | null;
  readonly id: string;
  readonly priority: string;
  readonly status: string;
}

export interface WorkloadPerson {
  readonly id: string;
  readonly name: string;
}

export interface WorkloadWeek {
  readonly loadHours: number;
  readonly overloaded: boolean;
  readonly taskCount: number;
  readonly weekStart: string;
}

export interface WorkloadPersonRow {
  readonly name: string;
  readonly overdueCount: number;
  readonly overloadedWeekCount: number;
  readonly peakLoadHours: number;
  readonly unscheduled: {
    readonly loadHours: number;
    readonly taskCount: number;
  };
  readonly userId: string;
  readonly weeks: readonly WorkloadWeek[];
}

export interface WorkloadView {
  readonly capacityHours: number;
  readonly people: readonly WorkloadPersonRow[];
  readonly weeks: readonly string[];
}

interface Bucket {
  hours: number;
  count: number;
}

export const aggregateWorkload = (input: {
  readonly capacityHours: number;
  readonly people: readonly WorkloadPerson[];
  readonly tasks: readonly WorkloadTask[];
  readonly today: string;
}): WorkloadView => {
  const { capacityHours, people, tasks, today } = input;
  const weekStarts = weekStartsFrom(today, WORKLOAD_WEEKS);
  const firstWeek = weekStarts[0] ?? today;
  const horizon = toDate(
    toUtcMs(firstWeek) + WORKLOAD_WEEKS * DAYS_PER_WEEK * DAY_MS
  );
  const state = new Map(
    people.map(({ id }) => [
      id,
      {
        overdue: 0,
        unscheduled: { count: 0, hours: 0 } as Bucket,
        weeks: weekStarts.map((): Bucket => ({ count: 0, hours: 0 })),
      },
    ])
  );

  for (const task of tasks) {
    if (task.status === "done") {
      continue;
    }
    const hours = estimateHours(task.estimate, task.priority);
    const { dueDate } = task;
    if (dueDate !== null && dueDate >= horizon) {
      continue;
    }
    const overdue = dueDate !== null && dueDate < firstWeek;
    // Late work lands in the current week: it is still to be done now.
    const weekIndex =
      dueDate === null
        ? -1
        : Math.max(
            0,
            Math.floor(
              (toUtcMs(dueDate) - toUtcMs(firstWeek)) / (DAYS_PER_WEEK * DAY_MS)
            )
          );
    for (const assigneeId of new Set(task.assigneeIds)) {
      const person = state.get(assigneeId);
      if (!person) {
        continue;
      }
      const bucket =
        weekIndex === -1 ? person.unscheduled : person.weeks[weekIndex];
      if (bucket) {
        bucket.count += 1;
        bucket.hours += hours;
      }
      if (overdue) {
        person.overdue += 1;
      }
    }
  }

  const rows = people.map((person): WorkloadPersonRow => {
    const entry = state.get(person.id);
    const weeks = weekStarts.map((weekStart, index): WorkloadWeek => {
      const bucket = entry?.weeks[index];
      const loadHours = roundHours(bucket?.hours ?? 0);
      return {
        loadHours,
        overloaded: loadHours > capacityHours,
        taskCount: bucket?.count ?? 0,
        weekStart,
      };
    });
    return {
      name: person.name,
      overdueCount: entry?.overdue ?? 0,
      overloadedWeekCount: weeks.filter(({ overloaded }) => overloaded).length,
      peakLoadHours: Math.max(0, ...weeks.map(({ loadHours }) => loadHours)),
      unscheduled: {
        loadHours: roundHours(entry?.unscheduled.hours ?? 0),
        taskCount: entry?.unscheduled.count ?? 0,
      },
      userId: person.id,
      weeks,
    };
  });
  return {
    capacityHours,
    people: rows.toSorted(
      (left, right) =>
        right.overloadedWeekCount - left.overloadedWeekCount ||
        right.peakLoadHours - left.peakLoadHours ||
        left.name.localeCompare(right.name)
    ),
    weeks: weekStarts,
  };
};
