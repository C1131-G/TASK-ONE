import { expect, test } from "bun:test";

import { defaultProjectViewSearch } from "../../features/projects/project-view-search";
import {
  MAX_BULK_SELECTION,
  createProjectViewStore,
} from "../../features/projects/providers/project-view-store";
import {
  clampColumnWidth,
  parseHiddenColumns,
  serializeHiddenColumns,
} from "../../features/tasks/task-table-columns";

test("hidden columns ignore columns that cannot be hidden and unknown IDs", () => {
  expect(parseHiddenColumns("task,due,actions,nope,estimate")).toEqual([
    "due",
    "estimate",
  ]);
  expect(parseHiddenColumns(null)).toEqual([]);
  expect(serializeHiddenColumns(["estimate", "due"])).toBe("due,estimate");
});

test("column widths clamp to each column's minimum and to the maximum", () => {
  expect(clampColumnWidth("task", 10)).toBe(180);
  expect(clampColumnWidth("task", 5000)).toBe(800);
  expect(clampColumnWidth("due", 133.4)).toBe(133);
});

test("the store clamps widths and caps bulk selection at the backend limit", () => {
  const store = createProjectViewStore(defaultProjectViewSearch);
  store.actions.setColumnWidth("status", 20);
  expect(store.state.columnWidths.status).toBe(110);

  const ids = Array.from(
    { length: MAX_BULK_SELECTION + 5 },
    (_, index) => `task-${index}`
  );
  store.actions.setSelectedTaskIds(ids);
  expect(store.state.selectedTaskIds).toHaveLength(MAX_BULK_SELECTION);

  store.actions.toggleTaskSelected("task-0", false);
  expect(store.state.selectedTaskIds).not.toContain("task-0");
  store.actions.toggleTaskSelected("extra", true);
  expect(store.state.selectedTaskIds).toHaveLength(MAX_BULK_SELECTION);
  store.actions.clearSelection();
  expect(store.state.selectedTaskIds).toEqual([]);
});
