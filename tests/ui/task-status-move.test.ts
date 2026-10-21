import { describe, expect, it } from "bun:test";

import { withTaskStatus } from "../../features/tasks/task-status-move";

const tasks = [
  { id: "a", status: "todo", title: "A" },
  { id: "b", status: "progress", title: "B" },
];

describe("withTaskStatus", () => {
  it("moves only the dropped task to the new column", () => {
    expect(withTaskStatus(tasks, { status: "done", taskId: "a" })).toEqual([
      { id: "a", status: "done", title: "A" },
      { id: "b", status: "progress", title: "B" },
    ]);
  });

  it("leaves the list alone for an unknown task", () => {
    expect(withTaskStatus(tasks, { status: "done", taskId: "zzz" })).toEqual(
      tasks
    );
  });
});
