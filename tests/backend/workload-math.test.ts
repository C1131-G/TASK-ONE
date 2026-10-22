import { describe, expect, it } from "bun:test";

import {
  WEEKLY_CAPACITY_HOURS,
  WORKLOAD_WEEKS,
  aggregateWorkload,
  estimateHours,
  weekStartsFrom,
} from "../../src/server/workload/workload-math";
import type { WorkloadTask } from "../../src/server/workload/workload-math";

// 2026-10-22 is a Thursday; its week starts on Monday the 19th.
const TODAY = "2026-10-22";

const task = (
  overrides: Partial<WorkloadTask> & { id: string }
): WorkloadTask => ({
  assigneeIds: ["ada"],
  dueDate: null,
  estimate: null,
  priority: "medium",
  status: "todo",
  ...overrides,
});

const people = [
  { id: "ada", name: "Ada" },
  { id: "bo", name: "Bo" },
];

describe("estimate parsing", () => {
  it("reads hours, minutes, days and weeks into hours", () => {
    expect(estimateHours("4h", "none")).toBe(4);
    expect(estimateHours("90m", "none")).toBe(1.5);
    expect(estimateHours("2d", "none")).toBe(16);
    expect(estimateHours("2 days", "none")).toBe(16);
    expect(estimateHours("1w", "none")).toBe(40);
    expect(estimateHours("1h 30m", "none")).toBe(1.5);
    expect(estimateHours("3", "none")).toBe(3);
    expect(estimateHours("1.5 hrs", "none")).toBe(1.5);
  });

  it("weights an unreadable or missing estimate by priority", () => {
    expect(estimateHours(null, "urgent")).toBe(6);
    expect(estimateHours("TBD", "high")).toBe(4);
    expect(estimateHours("", "medium")).toBe(3);
    expect(estimateHours(null, "low")).toBe(2);
    expect(estimateHours(null, "none")).toBe(2);
  });
});

describe("week buckets", () => {
  it("starts on the Monday of the current week and spans eight weeks", () => {
    const weeks = weekStartsFrom(TODAY, WORKLOAD_WEEKS);
    expect(weeks).toHaveLength(8);
    expect(weeks[0]).toBe("2026-10-19");
    expect(weeks[1]).toBe("2026-10-26");
    expect(weeks[7]).toBe("2026-12-07");
    expect(weekStartsFrom("2026-10-19", 1)).toEqual(["2026-10-19"]);
    expect(weekStartsFrom("2026-10-25", 1)).toEqual(["2026-10-19"]);
  });
});

const view = (tasks: WorkloadTask[], capacityHours = WEEKLY_CAPACITY_HOURS) =>
  aggregateWorkload({ capacityHours, people, tasks, today: TODAY });

describe("workload aggregation", () => {
  it("buckets open tasks by due week and sums their estimates", () => {
    const result = view([
      task({ dueDate: "2026-10-23", estimate: "4h", id: "t1" }),
      task({ dueDate: "2026-10-20", estimate: "8h", id: "t2" }),
      task({ dueDate: "2026-10-27", estimate: "2d", id: "t3" }),
    ]);
    const ada = result.people.find(({ userId }) => userId === "ada");
    expect(ada?.weeks[0]).toMatchObject({ loadHours: 12, taskCount: 2 });
    expect(ada?.weeks[1]).toMatchObject({ loadHours: 16, taskCount: 1 });
    expect(ada?.weeks[2]).toMatchObject({ loadHours: 0, taskCount: 0 });
    expect(result.weeks[0]).toBe("2026-10-19");
    expect(result.capacityHours).toBe(WEEKLY_CAPACITY_HOURS);
  });

  it("counts overdue work in the current week and reports it separately", () => {
    const ada = view([
      task({ dueDate: "2026-10-10", id: "late", priority: "high" }),
    ]).people.find(({ userId }) => userId === "ada");
    expect(ada?.weeks[0]).toMatchObject({ loadHours: 4, taskCount: 1 });
    expect(ada?.overdueCount).toBe(1);
  });

  it("keeps undated work apart and ignores done, archived-style and distant tasks", () => {
    const ada = view([
      task({ estimate: "3h", id: "undated" }),
      task({ dueDate: "2026-10-23", id: "done", status: "done" }),
      task({ dueDate: "2027-03-01", id: "far" }),
    ]).people.find(({ userId }) => userId === "ada");
    expect(ada?.unscheduled).toEqual({ loadHours: 3, taskCount: 1 });
    expect(ada?.weeks.every(({ taskCount }) => taskCount === 0)).toBe(true);
  });

  it("flags a week only when load is strictly above the threshold", () => {
    const tasks = [
      task({ dueDate: "2026-10-23", estimate: "10h", id: "a" }),
      task({ dueDate: "2026-10-27", estimate: "11h", id: "b" }),
    ];
    const ada = view(tasks, 10).people.find(({ userId }) => userId === "ada");
    expect(ada?.weeks[0]?.overloaded).toBe(false);
    expect(ada?.weeks[1]?.overloaded).toBe(true);
    expect(ada?.overloadedWeekCount).toBe(1);
    expect(ada?.peakLoadHours).toBe(11);
  });

  it("charges a shared task to every assignee and skips unknown people", () => {
    const result = view([
      task({
        assigneeIds: ["ada", "bo", "stranger"],
        dueDate: "2026-10-23",
        estimate: "2h",
        id: "shared",
      }),
    ]);
    expect(result.people.map(({ userId }) => userId).toSorted()).toEqual([
      "ada",
      "bo",
    ]);
    for (const person of result.people) {
      expect(person.weeks[0]).toMatchObject({ loadHours: 2, taskCount: 1 });
    }
  });

  it("lists the most overloaded people first and includes idle people", () => {
    const result = view(
      [
        task({
          assigneeIds: ["bo"],
          dueDate: "2026-10-23",
          estimate: "40h",
          id: "x",
        }),
      ],
      30
    );
    expect(result.people.map(({ userId }) => userId)).toEqual(["bo", "ada"]);
    expect(result.people[1]?.peakLoadHours).toBe(0);
  });
});
