import { describe, expect, it } from "bun:test";

import {
  addDays,
  datesAfterDrag,
  datesForDueDay,
  dayDiff,
  sameSpan,
} from "../../features/tasks/task-dates";
import { canEditTaskRecord } from "../../features/tasks/task-permissions";

const span = { dueDate: "2026-10-12", startDate: "2026-10-08" };

describe("task date arithmetic", () => {
  it("counts whole UTC days and crosses month ends", () => {
    expect(dayDiff("2026-10-12", "2026-10-15")).toBe(3);
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("moves both dates together when the bar is dragged", () => {
    expect(datesAfterDrag(span, "move", 2)).toEqual({
      dueDate: "2026-10-14",
      startDate: "2026-10-10",
    });
  });

  it("keeps the start on or before the due date when the start edge is dragged", () => {
    expect(datesAfterDrag(span, "start", -3).startDate).toBe("2026-10-05");
    expect(datesAfterDrag(span, "start", 10).startDate).toBe("2026-10-12");
  });

  it("keeps the due date on or after the start when the end edge is dragged", () => {
    expect(datesAfterDrag(span, "due", -20).dueDate).toBe("2026-10-08");
    expect(datesAfterDrag(span, "due", 4).dueDate).toBe("2026-10-16");
  });

  it("keeps a missing start date missing when the bar is moved", () => {
    expect(
      datesAfterDrag({ dueDate: "2026-10-12", startDate: null }, "move", 1)
    ).toEqual({ dueDate: "2026-10-13", startDate: null });
  });

  it("keeps the span length when a task is dropped on another day", () => {
    expect(datesForDueDay(span, "2026-10-20")).toEqual({
      dueDate: "2026-10-20",
      startDate: "2026-10-16",
    });
    expect(
      datesForDueDay({ dueDate: null, startDate: "2026-10-08" }, "2026-10-20")
    ).toBeNull();
  });

  it("compares spans field by field", () => {
    expect(sameSpan(span, { ...span })).toBe(true);
    expect(sameSpan(span, { ...span, dueDate: "2026-10-13" })).toBe(false);
  });
});

describe("task edit permission", () => {
  const task = { assigneeIds: ["ada"], createdById: "grace" };

  it("allows admins, the creator and assignees only", () => {
    expect(canEditTaskRecord(task, "linus", true)).toBe(true);
    expect(canEditTaskRecord(task, "grace", false)).toBe(true);
    expect(canEditTaskRecord(task, "ada", false)).toBe(true);
    expect(canEditTaskRecord(task, "linus", false)).toBe(false);
    expect(canEditTaskRecord(task, null, false)).toBe(false);
  });
});
