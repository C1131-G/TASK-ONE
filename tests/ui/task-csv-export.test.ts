import { expect, it } from "bun:test";

import {
  csvDownloadName,
  exportFiltersFromSearch,
  describeImportErrors,
} from "../../features/tasks/task-csv-view";

it("sends only the filters the person actually set", () => {
  expect(
    exportFiltersFromSearch({
      overdue: false,
      priority: "all",
      q: "",
      status: "all",
    })
  ).toEqual({});
  expect(
    exportFiltersFromSearch({
      overdue: true,
      priority: "high",
      q: "launch",
      status: "todo",
    })
  ).toEqual({ overdue: true, priority: "high", q: "launch", status: "todo" });
});

it("adds a project filter when exporting from one project", () => {
  expect(
    exportFiltersFromSearch(
      { overdue: false, priority: "all", q: "", status: "all" },
      "7b0c1c1e-6a59-4a5a-9d0e-2b0e9a9a7a11"
    )
  ).toEqual({ projectId: "7b0c1c1e-6a59-4a5a-9d0e-2b0e9a9a7a11" });
});

it("names the download after the day it was made", () => {
  expect(csvDownloadName("2026-06-01")).toBe("tasks-2026-06-01.csv");
});

it("describes import problems by row and column", () => {
  expect(
    describeImportErrors([
      { column: "due_date", line: 3, message: "Use a real date." },
      { column: null, line: 1, message: "The file is empty." },
    ])
  ).toEqual(["Row 3, due_date: Use a real date.", "The file is empty."]);
});

it("shows at most twenty problems and counts the rest", () => {
  const errors = Array.from({ length: 25 }, (_, index) => ({
    column: "title",
    line: index + 2,
    message: "Enter a title.",
  }));
  const described = describeImportErrors(errors);
  expect(described).toHaveLength(21);
  expect(described.at(-1)).toBe("…and 5 more problems.");
});
