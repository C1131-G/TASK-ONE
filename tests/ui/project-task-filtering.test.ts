import { expect, test } from "bun:test";

import {
  filterProjectTasks,
  groupProjectTasks,
} from "../../features/projects/project-task-filtering";
import type { ProjectTaskViewItem } from "../../features/projects/types/project-task-view-types";

const makeTask = (
  overrides: Partial<ProjectTaskViewItem> &
    Pick<ProjectTaskViewItem, "id" | "title">
): ProjectTaskViewItem => ({
  assigneeIds: [],
  assignees: [],
  completedSubtaskCount: 0,
  createdById: "creator",
  dependencyIds: [],
  description: null,
  dueDate: null,
  estimate: null,
  labelIds: [],
  position: 0,
  priority: "medium",
  projectId: "project",
  projectTaskNumber: 1,
  recurrence: null,
  startDate: null,
  status: "todo",
  subtaskCount: 0,
  version: 1,
  ...overrides,
});

const tasks = [
  makeTask({
    dueDate: "2026-11-02",
    id: "a",
    priority: "low",
    projectTaskNumber: 7,
    status: "done",
    title: "Write release notes",
  }),
  makeTask({
    id: "b",
    priority: "urgent",
    projectTaskNumber: 12,
    title: "Fix login",
  }),
  makeTask({
    dueDate: "2026-10-20",
    id: "c",
    priority: "high",
    projectTaskNumber: 3,
    title: "Audit uploads",
  }),
];

const allTasks = {
  priority: "all",
  projectKey: "WEB",
  query: "",
  sort: "manual",
  status: "all",
};

test("matches the query against the title or the task key", () => {
  const byTitle = filterProjectTasks(tasks, { ...allTasks, query: " LOGIN " });
  const byKey = filterProjectTasks(tasks, { ...allTasks, query: "web-3" });
  expect(byTitle.map(({ id }) => id)).toEqual(["b"]);
  expect(byKey.map(({ id }) => id)).toEqual(["c"]);
});

test("filters by status and priority together", () => {
  const filtered = filterProjectTasks(tasks, {
    ...allTasks,
    priority: "urgent",
    status: "todo",
  });
  expect(filtered.map(({ id }) => id)).toEqual(["b"]);
});

test("sorts by due date with undated tasks last", () => {
  const sorted = filterProjectTasks(tasks, { ...allTasks, sort: "due" });
  expect(sorted.map(({ id }) => id)).toEqual(["c", "a", "b"]);
});

test("sorts by priority from urgent to none", () => {
  const sorted = filterProjectTasks(tasks, { ...allTasks, sort: "priority" });
  expect(sorted.map(({ id }) => id)).toEqual(["b", "c", "a"]);
});

test("groups by status in workflow order and skips empty groups", () => {
  const groups = groupProjectTasks(tasks, "status");
  expect(groups.map(({ id, tasks: grouped }) => [id, grouped.length])).toEqual([
    ["todo", 2],
    ["done", 1],
  ]);
});

test("keeps one unlabeled group when not grouping", () => {
  expect(groupProjectTasks(tasks, "none")).toEqual([
    { id: "all", label: "", tasks },
  ]);
});
