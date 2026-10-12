import { describe, expect, it } from "bun:test";

import type { EditableTask } from "../../components/workspace/task-details-draft";
import {
  draftFromTask,
  isDraftDirty,
} from "../../components/workspace/task-details-draft";

const task: EditableTask = {
  assigneeIds: ["b-id", "a-id"],
  createdById: "a-id",
  dependencyIds: [],
  description: null,
  dueDate: "2026-10-12",
  estimate: null,
  id: "task-1",
  labelIds: [],
  priority: "none",
  projectId: "project-1",
  recurrence: null,
  startDate: null,
  status: "todo",
  title: "Write spec",
  version: 3,
};

describe("task details draft", () => {
  it("is clean until a field differs from the saved task", () => {
    const draft = draftFromTask(task);
    expect(isDraftDirty(draft, task)).toBe(false);
    expect(isDraftDirty({ ...draft, estimate: "2h" }, task)).toBe(true);
  });

  it("treats assignees as a set, so tick order does not make the form dirty", () => {
    const draft = draftFromTask(task);
    expect(
      isDraftDirty({ ...draft, assigneeIds: ["a-id", "b-id"] }, task)
    ).toBe(false);
  });

  it("does not mutate the saved assignee list when sorting", () => {
    draftFromTask(task);
    expect(task.assigneeIds).toEqual(["b-id", "a-id"]);
  });
});
