import { expect, test } from "bun:test";

import {
  milestoneDateAfterDrag,
  withMilestoneDate,
} from "../../components/workspace/milestone-dates";

const kickoff = {
  completed: true,
  dueDate: "2026-10-09",
  id: "a",
  name: "Kickoff",
};
const beta = { completed: false, dueDate: "2026-10-17", id: "b", name: "Beta" };
const unscheduled = {
  completed: false,
  dueDate: null,
  id: "c",
  name: "Unscheduled",
};
const list = [kickoff, beta, unscheduled];

test("a drag moves a milestone by whole days, across month ends", () => {
  expect(milestoneDateAfterDrag("2026-10-30", 3)).toBe("2026-11-02");
  expect(milestoneDateAfterDrag("2026-03-01", -1)).toBe("2026-02-28");
});

test("moving one milestone keeps every other milestone, its order and its undated state", () => {
  const moved = withMilestoneDate(list, "b", "2026-10-20");
  expect(moved.map(({ id }) => id)).toEqual(["a", "b", "c"]);
  expect(moved[1]).toEqual({ ...beta, dueDate: "2026-10-20" });
  expect(moved[0]).toBe(kickoff);
  expect(moved[2]?.dueDate).toBeNull();
});

test("moving an unknown id changes nothing", () => {
  expect(withMilestoneDate(list, "zzz", "2026-10-20")).toEqual(list);
});
