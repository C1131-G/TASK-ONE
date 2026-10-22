import { describe, expect, it } from "bun:test";

import { computeDependencyLayout } from "../../features/projects/timeline-dependencies";
import type { DependencyTask } from "../../features/projects/timeline-dependencies";

const GEOMETRY = {
  barHeight: 24,
  barTop: 6,
  dayCount: 60,
  dayWidth: 32,
  from: "2026-10-01",
  rowHeight: 36,
} as const;

const task = (
  id: string,
  startDate: string | null,
  dueDate: string | null,
  dependencyIds: readonly string[] = [],
  status = "todo"
): DependencyTask => ({
  dependencyIds,
  dueDate,
  id,
  startDate,
  status,
  title: `Task ${id}`,
});

const layout = (
  tasks: readonly DependencyTask[],
  visibleIds: readonly string[] = tasks.map(({ id }) => id)
) =>
  computeDependencyLayout({
    ...GEOMETRY,
    rowIndexById: new Map(visibleIds.map((id, index) => [id, index + 1])),
    tasks,
  });

describe("timeline dependency arrows", () => {
  it("routes a finish-to-start elbow from the blocker's end to the dependent's start", () => {
    const { arrows } = layout([
      task("a", "2026-10-01", "2026-10-05"),
      task("b", "2026-10-08", "2026-10-09", ["a"]),
    ]);
    expect(arrows).toHaveLength(1);
    expect(arrows[0]).toMatchObject({
      blockerId: "a",
      clippedEnd: false,
      clippedStart: false,
      conflict: false,
      cyclic: false,
      path: "M 160 54 H 172 V 90 H 224",
      taskId: "b",
    });
  });

  it("detours around the rows when the dependent starts too soon to elbow", () => {
    const { arrows } = layout([
      task("a", "2026-10-01", "2026-10-05"),
      task("b", "2026-10-04", "2026-10-09", ["a"]),
    ]);
    expect(arrows[0]?.path).toBe("M 160 54 H 172 V 72 H 84 V 90 H 96");
  });

  it("flags a task that starts before its blocker ends, in the arrow and in text", () => {
    const { arrows, details } = layout([
      task("a", "2026-10-01", "2026-10-05"),
      task("b", "2026-10-04", "2026-10-09", ["a"]),
    ]);
    expect(arrows[0]?.conflict).toBe(true);
    expect(details.get("b")?.conflict).toBe(true);
    expect(details.get("b")?.description).toBe(
      "Blocked by Task a. Starts before its blocker ends: Task a ends 2026-10-05."
    );
    expect(details.get("a")?.conflict).toBe(false);
    expect(details.get("a")?.description).toBe("Blocks Task b.");
  });

  it("allows a hand-off on the day the blocker ends and ignores finished blockers", () => {
    const sameDay = layout([
      task("a", "2026-10-01", "2026-10-05"),
      task("b", "2026-10-05", "2026-10-09", ["a"]),
    ]);
    expect(sameDay.arrows[0]?.conflict).toBe(false);
    const finished = layout([
      task("a", "2026-10-01", "2026-10-05", [], "done"),
      task("b", "2026-10-02", "2026-10-09", ["a"]),
    ]);
    expect(finished.arrows[0]?.conflict).toBe(false);
  });

  it("describes endpoints that cannot be drawn instead of dropping them", () => {
    const tasks = [
      task("a", "2026-10-01", "2026-10-05"),
      task("b", "2026-10-08", "2026-10-09", ["a", "hidden", "plain", "ghost"]),
      task("hidden", "2026-10-01", "2026-10-02"),
      task("plain", null, null),
    ];
    const { arrows, details } = layout(tasks, ["a", "b"]);
    expect(arrows.map(({ blockerId }) => blockerId)).toEqual(["a"]);
    expect(details.get("b")?.description).toBe(
      "Blocked by Task a, Task hidden, Task plain, another task. Not drawn: Task hidden is hidden by the current filters; Task plain has no dates; another task is not on this timeline."
    );
  });

  it("clamps arrows to the visible range and omits ones fully outside it", () => {
    const { arrows, details } = layout([
      task("early", "2026-09-01", "2026-09-10"),
      task("a", "2026-10-02", "2026-10-03", ["early"]),
      task("far", "2026-12-20", "2026-12-22"),
      task("late", "2026-12-25", "2026-12-26", ["far"]),
      task("tail", "2026-12-25", "2026-12-26", ["a"]),
    ]);
    const byTask = new Map(arrows.map((arrow) => [arrow.taskId, arrow]));
    expect(byTask.get("a")).toMatchObject({
      clippedEnd: false,
      clippedStart: true,
      path: "M 0 54 H 12 V 90 H 32",
    });
    expect(byTask.get("tail")).toMatchObject({ clippedEnd: true });
    expect(byTask.get("tail")?.path.endsWith("H 1920")).toBe(true);
    expect(byTask.has("late")).toBe(false);
    expect(details.get("late")?.description).toBe(
      "Blocked by Task far. Not drawn: the link from Task far is outside the visible dates."
    );
  });

  it("marks a circular dependency without looping", () => {
    const { arrows, details } = layout([
      task("a", "2026-10-01", "2026-10-03", ["c"]),
      task("b", "2026-10-04", "2026-10-06", ["a"]),
      task("c", "2026-10-07", "2026-10-09", ["b"]),
      task("d", "2026-10-10", "2026-10-11", ["c"]),
    ]);
    expect(
      arrows.map(
        ({ blockerId, cyclic, taskId }) => `${blockerId}>${taskId}:${cyclic}`
      )
    ).toEqual(["c>a:true", "a>b:true", "b>c:true", "c>d:false"]);
    expect(details.get("b")?.description).toBe(
      "Blocked by Task a. Blocks Task c. Circular dependency through Task a, Task c."
    );
    expect(details.get("d")?.description).not.toContain("Circular");
  });

  it("gives a task with no dependencies no description", () => {
    const { arrows, details } = layout([task("a", "2026-10-01", "2026-10-05")]);
    expect(arrows).toEqual([]);
    expect(details.get("a")?.description).toBeNull();
  });
});
