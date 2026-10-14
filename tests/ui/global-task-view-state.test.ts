import { describe, expect, it } from "bun:test";

import {
  GLOBAL_TASK_VIEWS,
  MY_TASK_VIEWS,
  defaultGlobalTaskSearch,
  filterGlobalTasks,
  globalTaskHref,
  groupGlobalTasks,
  groupTasksByDueDate,
  normalizeGlobalTaskSearch,
  readGlobalTaskSearchRaw,
  sortGlobalTasks,
  writeGlobalTaskSearch,
} from "../../features/tasks/global-task-view-state";
import { columnWidthsFromPreferences } from "../../features/tasks/task-table-columns";

const task = (overrides: Record<string, unknown>) => ({
  assignees: [{ name: "Ada" }],
  dueDate: null,
  id: "task-1",
  priority: "none",
  projectKey: "UIE",
  projectName: "Engine",
  status: "todo",
  title: "Write spec",
  ...overrides,
});

describe("workspace task URL state", () => {
  it("reads the title sort from the legacy name value and fills defaults", () => {
    const raw = readGlobalTaskSearchRaw(
      new URLSearchParams("sort=name&q=Spec")
    );
    expect(raw.sort).toBe("title");
    expect(raw.q).toBe("Spec");
    expect(raw.status).toBe("all");
  });

  it("omits default values and keeps unrelated params when writing", () => {
    const params = writeGlobalTaskSearch(
      new URLSearchParams("savedView=keep"),
      { ...defaultGlobalTaskSearch, priority: "high", view: "table" }
    );
    expect(params.get("savedView")).toBe("keep");
    expect(params.get("priority")).toBe("high");
    expect(params.get("view")).toBe("table");
    expect(params.has("status")).toBe(false);
    expect(params.has("sort")).toBe(false);
  });

  it("builds tab links that carry every active filter", () => {
    const raw = { ...defaultGlobalTaskSearch, q: "api", status: "review" };
    expect(globalTaskHref("/tasks", raw, { view: "board" })).toBe(
      "/tasks?q=api&status=review&view=board"
    );
    expect(globalTaskHref("/tasks", defaultGlobalTaskSearch)).toBe("/tasks");
  });

  it("falls back to defaults for unknown values and clamps the month offset", () => {
    const normalized = normalizeGlobalTaskSearch(
      {
        ...defaultGlobalTaskSearch,
        hidden: "start,project,actions,bogus",
        monthOffset: "99",
        priority: "critical",
        q: "  Mixed CASE  ",
        view: "gantt",
      },
      GLOBAL_TASK_VIEWS
    );
    expect(normalized.priority).toBe("all");
    expect(normalized.view).toBe("list");
    expect(normalized.monthOffset).toBe(24);
    expect(normalized.q).toBe("mixed case");
    // Only hideable workspace columns survive; start is not a workspace column.
    expect(normalized.hidden).toEqual(["project"]);
  });

  it("normalizes calendar views for my tasks", () => {
    const normalized = normalizeGlobalTaskSearch(
      { ...defaultGlobalTaskSearch, view: "calendar" },
      MY_TASK_VIEWS
    );
    expect(normalized.view).toBe("calendar");
  });
});

const search = (overrides: Partial<typeof defaultGlobalTaskSearch>) =>
  normalizeGlobalTaskSearch(
    { ...defaultGlobalTaskSearch, ...overrides },
    GLOBAL_TASK_VIEWS
  );

describe("workspace task rows", () => {
  const tasks = [
    task({
      dueDate: "2026-10-05",
      id: "a",
      priority: "low",
      status: "done",
      title: "Zeta",
    }),
    task({
      dueDate: "2026-10-01",
      id: "b",
      priority: "urgent",
      status: "todo",
      title: "Alpha",
    }),
    task({
      dueDate: null,
      id: "c",
      priority: "high",
      projectKey: "OTH",
      projectName: "Other",
      status: "progress",
      title: "Mid",
    }),
  ];

  it("filters by status, priority and query across title, project and key", () => {
    expect(
      filterGlobalTasks(tasks, search({ status: "todo" }), "2026-10-10").map(
        ({ id }) => id
      )
    ).toEqual(["b"]);
    expect(
      filterGlobalTasks(tasks, search({ priority: "high" }), "2026-10-10").map(
        ({ id }) => id
      )
    ).toEqual(["c"]);
    expect(
      filterGlobalTasks(tasks, search({ q: "oth" }), "2026-10-10").map(
        ({ id }) => id
      )
    ).toEqual(["c"]);
  });

  it("limits overdue to open tasks with a past due date", () => {
    const overdue = filterGlobalTasks(
      tasks,
      search({ overdue: "true" }),
      "2026-10-10"
    );
    expect(overdue.map(({ id }) => id)).toEqual(["b"]);
  });

  it("sorts by due date, priority and title", () => {
    expect(sortGlobalTasks(tasks, "due").map(({ id }) => id)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(sortGlobalTasks(tasks, "priority").map(({ id }) => id)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(sortGlobalTasks(tasks, "title").map(({ id }) => id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("groups by status in workflow order and by project alphabetically", () => {
    expect(
      groupGlobalTasks(tasks, "status").map((group) => group.label)
    ).toEqual(["To Do", "In Progress", "Done"]);
    expect(
      groupGlobalTasks(tasks, "project").map((group) => group.label)
    ).toEqual(["Engine", "Other"]);
    expect(groupGlobalTasks(tasks, "none")[0]?.tasks).toHaveLength(3);
  });

  it("buckets assigned tasks by due date and skips empty buckets", () => {
    const groups = groupTasksByDueDate(tasks, "2026-10-01");
    expect(groups.map((group) => group.id)).toEqual([
      "today",
      "no-date",
      "completed",
    ]);
    expect(groups[0]?.tasks.map(({ id }) => id)).toEqual(["b"]);
  });
});

describe("stored column widths", () => {
  it("keeps only known columns and clamps their widths", () => {
    expect(
      columnWidthsFromPreferences({ due: 10_000, legacy: 300, project: 200 })
    ).toEqual({ due: 800, project: 200 });
    expect(columnWidthsFromPreferences()).toEqual({});
  });
});
