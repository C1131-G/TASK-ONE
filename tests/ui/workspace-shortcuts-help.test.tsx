import { expect, test } from "bun:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { WorkspaceShortcutsList } from "@/components/workspace/workspace-shortcuts-help";

const employee = {
  canCreateTask: true,
  role: "employee",
  taskDrawer: "none",
} as const;

const render = (props: Parameters<typeof WorkspaceShortcutsList>[0]) =>
  renderToStaticMarkup(createElement(WorkspaceShortcutsList, props));

test("shortcut list names each key as a separate kbd under a labelled group", () => {
  const markup = render({ isMac: false, viewer: employee });

  expect(markup).toContain("Create task");
  expect(markup).toContain("Go to Inbox");
  expect(markup).toContain("Ctrl");
  expect(markup).toContain('aria-labelledby="');
  expect(markup.match(/<kbd/gu)?.length).toBeGreaterThanOrEqual(9);
});

test("shortcut list shows the Cmd symbol on Mac", () => {
  expect(render({ isMac: true, viewer: employee })).toContain("⌘");
});

test("shortcut list leaves out what the viewer cannot do", () => {
  const markup = render({ isMac: false, viewer: employee });

  expect(markup).not.toContain("Assign task");
  expect(markup).not.toContain("Invite member");
});

test("shortcut list includes task actions for an editable open task", () => {
  const markup = render({
    isMac: false,
    viewer: { ...employee, taskDrawer: "editable" },
  });

  expect(markup).toContain("Assign task");
  expect(markup).toContain("Set task status");
});
