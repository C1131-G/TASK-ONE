import { expect, test } from "bun:test";

import {
  defaultProjectViewSearch,
  projectViewHref,
  projectViewSearchToSettings,
  projectViewSettingsToSearch,
  readProjectViewSearch,
  writeProjectViewSearch,
} from "../../components/workspace/project-view-search";

test("reads defaults for an empty URL and ignores unknown values", () => {
  expect(readProjectViewSearch(new URLSearchParams())).toEqual({
    group: "status",
    priority: "all",
    q: "",
    sort: "manual",
    status: "all",
  });
  expect(
    readProjectViewSearch(
      new URLSearchParams(
        "status=bogus&priority=extreme&sort=random&group=assignee"
      )
    )
  ).toMatchObject({
    group: "status",
    priority: "all",
    sort: "manual",
    status: "all",
  });
});

test("omits default values from the URL and keeps the view param", () => {
  const params = writeProjectViewSearch(
    new URLSearchParams("view=board&status=todo"),
    { ...defaultProjectViewSearch, q: "login", sort: "due", status: "all" }
  );
  expect(params.get("view")).toBe("board");
  expect(params.get("status")).toBeNull();
  expect(params.get("q")).toBe("login");
  expect(params.get("sort")).toBe("due");
  expect(params.has("group")).toBe(false);
});

test("round-trips view state through saved-view settings", () => {
  const search = {
    group: "none",
    priority: "high",
    q: "release",
    sort: "priority",
    status: "review",
  };
  const settings = projectViewSearchToSettings(search);
  expect(settings).toEqual({
    filters: { priority: ["high"], query: "release", status: ["review"] },
    groupBy: "none",
    sort: { direction: "asc", field: "priority" },
  });
  expect(projectViewSettingsToSearch(settings)).toEqual(search);
});

test("builds a saved-view link that carries the view state", () => {
  const href = projectViewHref("project-1", "view-9", {
    ...defaultProjectViewSearch,
    priority: "urgent",
  });
  expect(href).toBe("/projects/project-1?view=saved-view-9&priority=urgent");
});
