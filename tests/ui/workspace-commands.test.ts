import { describe, expect, it } from "bun:test";

import {
  createShortcutMatcher,
  getAvailableCommands,
  isPaletteToggle,
  isTypingTarget,
  readModalState,
} from "../../components/workspace/workspace-commands";
import type {
  ShortcutContext,
  ShortcutKeyEvent,
  Viewer,
} from "../../components/workspace/workspace-commands";

const admin: Viewer = {
  canCreateTask: true,
  role: "admin",
  taskDrawer: "none",
};
const employee: Viewer = {
  canCreateTask: true,
  role: "employee",
  taskDrawer: "none",
};

const key = (
  value: string,
  overrides: Partial<ShortcutKeyEvent> = {}
): ShortcutKeyEvent => ({
  altKey: false,
  ctrlKey: false,
  isComposing: false,
  key: value,
  metaKey: false,
  repeat: false,
  shiftKey: false,
  target: { tagName: "BODY" },
  ...overrides,
});

const idle = (viewer: Viewer = employee): ShortcutContext => ({
  modal: "none",
  viewer,
});

const ids = (viewer: Viewer) =>
  getAvailableCommands(viewer).map(({ id }) => id);

describe("getAvailableCommands", () => {
  it("lists create, navigation and help for an employee with projects", () => {
    expect(ids(employee)).toEqual([
      "create-task",
      "go-home",
      "go-tasks",
      "go-projects",
      "go-inbox",
      "go-my-time",
      "go-workload",
      "show-shortcuts",
    ]);
  });

  it("adds budgets and the admin settings pages for admins only", () => {
    expect(ids(admin)).toEqual(
      expect.arrayContaining([
        "go-budgets",
        "go-intake-forms",
        "go-webhooks",
        "go-github",
      ])
    );
    for (const id of [
      "go-budgets",
      "go-intake-forms",
      "go-webhooks",
      "go-github",
    ]) {
      expect(ids(employee)).not.toContain(id);
    }
  });

  it("points the new navigation entries at their pages", () => {
    const hrefs = Object.fromEntries(
      getAvailableCommands(admin).map(({ href, id }) => [id, href])
    );
    expect(hrefs["go-my-time"]).toBe("/my-time");
    expect(hrefs["go-workload"]).toBe("/workload");
    expect(hrefs["go-budgets"]).toBe("/budgets");
    expect(hrefs["go-intake-forms"]).toBe("/settings?section=intake");
    expect(hrefs["go-webhooks"]).toBe("/settings/webhooks");
    expect(hrefs["go-github"]).toBe("/settings/github");
  });

  it("adds admin-only actions for admins", () => {
    expect(ids(admin)).toContain("new-project");
    expect(ids(admin)).toContain("invite-member");
    expect(ids(employee)).not.toContain("new-project");
    expect(ids(employee)).not.toContain("invite-member");
  });

  it("hides creating a task when there is no project to put it in", () => {
    expect(ids({ ...employee, canCreateTask: false })).not.toContain(
      "create-task"
    );
  });

  it("offers assign and status only for an editable open task", () => {
    expect(ids({ ...employee, taskDrawer: "editable" })).toEqual(
      expect.arrayContaining(["assign-task", "set-status"])
    );
    expect(ids({ ...employee, taskDrawer: "readonly" })).not.toContain(
      "assign-task"
    );
    expect(ids(employee)).not.toContain("set-status");
  });

  it("gives each shortcut a key hint", () => {
    const commands = getAvailableCommands({
      ...admin,
      taskDrawer: "editable",
    });
    const hints = Object.fromEntries(
      commands.map(({ id, keys }) => [id, keys.join(" ")])
    );
    expect(hints["create-task"]).toBe("C");
    expect(hints["assign-task"]).toBe("A");
    expect(hints["set-status"]).toBe("S");
    expect(hints["go-home"]).toBe("G H");
    expect(hints["go-tasks"]).toBe("G T");
    expect(hints["go-projects"]).toBe("G P");
    expect(hints["go-inbox"]).toBe("G I");
    expect(hints["go-my-time"]).toBe("G M");
    expect(hints["go-workload"]).toBe("G W");
    expect(hints["go-budgets"]).toBe("G B");
    expect(hints["show-shortcuts"]).toBe("?");
  });
});

describe("isPaletteToggle", () => {
  it("uses Cmd on Mac and ignores Ctrl", () => {
    expect(isPaletteToggle(key("k", { metaKey: true }), true)).toBe(true);
    expect(isPaletteToggle(key("k", { ctrlKey: true }), true)).toBe(false);
  });

  it("uses Ctrl elsewhere and ignores Cmd", () => {
    expect(isPaletteToggle(key("K", { ctrlKey: true }), false)).toBe(true);
    expect(isPaletteToggle(key("k", { metaKey: true }), false)).toBe(false);
  });

  it("needs the modifier", () => {
    expect(isPaletteToggle(key("k"), false)).toBe(false);
  });
});

describe("isTypingTarget", () => {
  it("is true for text fields, textareas, selects and contenteditable", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTypingTarget({ isContentEditable: true, tagName: "DIV" })).toBe(
      true
    );
  });

  it("is false for buttons, the body and a missing target", () => {
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget({ tagName: "BODY" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

const dialog = (taskDrawer: boolean) => ({
  dataset: taskDrawer ? { taskDrawer: "" } : {},
});

describe("readModalState", () => {
  it("is none without an open dialog", () => {
    expect(readModalState([])).toBe("none");
  });

  it("is task-drawer when the task drawer is the only dialog", () => {
    expect(readModalState([dialog(true)])).toBe("task-drawer");
  });

  it("is other when any non-drawer dialog is open", () => {
    expect(readModalState([dialog(true), dialog(false)])).toBe("other");
    expect(readModalState([dialog(false)])).toBe("other");
  });
});

describe("createShortcutMatcher", () => {
  it("matches a single key", () => {
    const matcher = createShortcutMatcher();
    expect(matcher.handle(key("c"), idle(), 0)?.id).toBe("create-task");
    expect(matcher.handle(key("?", { shiftKey: true }), idle(), 0)?.id).toBe(
      "show-shortcuts"
    );
  });

  it("matches G then a key within the window", () => {
    const matcher = createShortcutMatcher();
    expect(matcher.handle(key("g"), idle(), 0)).toBeUndefined();
    expect(matcher.handle(key("t"), idle(), 500)?.id).toBe("go-tasks");
  });

  it("matches the new G sequences only for people who may open the page", () => {
    const matcher = createShortcutMatcher();
    matcher.handle(key("g"), idle(admin), 0);
    expect(matcher.handle(key("b"), idle(admin), 10)?.id).toBe("go-budgets");
    matcher.handle(key("g"), idle(employee), 20);
    expect(matcher.handle(key("b"), idle(employee), 30)).toBeUndefined();
    matcher.handle(key("g"), idle(employee), 40);
    expect(matcher.handle(key("m"), idle(employee), 50)?.id).toBe("go-my-time");
  });

  it("forgets G after the window passes", () => {
    const matcher = createShortcutMatcher({ sequenceWindowMs: 1000 });
    matcher.handle(key("g"), idle(), 0);
    expect(matcher.handle(key("t"), idle(), 1001)).toBeUndefined();
  });

  it("does not treat a bare second key as a navigation after a miss", () => {
    const matcher = createShortcutMatcher();
    matcher.handle(key("g"), idle(), 0);
    expect(matcher.handle(key("x"), idle(), 100)).toBeUndefined();
    expect(matcher.handle(key("h"), idle(), 200)).toBeUndefined();
  });

  it("consumes the sequence once", () => {
    const matcher = createShortcutMatcher();
    matcher.handle(key("g"), idle(), 0);
    matcher.handle(key("h"), idle(), 10);
    expect(matcher.handle(key("h"), idle(), 20)).toBeUndefined();
  });

  it("ignores keys typed into inputs", () => {
    const matcher = createShortcutMatcher();
    const typing = key("c", { target: { tagName: "INPUT" } });
    expect(matcher.handle(typing, idle(), 0)).toBeUndefined();
  });

  it("drops a pending G when the user starts typing", () => {
    const matcher = createShortcutMatcher();
    matcher.handle(key("g"), idle(), 0);
    matcher.handle(key("x", { target: { tagName: "TEXTAREA" } }), idle(), 10);
    expect(matcher.handle(key("t"), idle(), 20)).toBeUndefined();
  });

  it("ignores modified keys, repeats and composition", () => {
    const matcher = createShortcutMatcher();
    expect(
      matcher.handle(key("c", { ctrlKey: true }), idle(), 0)
    ).toBeUndefined();
    expect(
      matcher.handle(key("c", { metaKey: true }), idle(), 0)
    ).toBeUndefined();
    expect(
      matcher.handle(key("c", { altKey: true }), idle(), 0)
    ).toBeUndefined();
    expect(
      matcher.handle(key("c", { repeat: true }), idle(), 0)
    ).toBeUndefined();
    expect(
      matcher.handle(key("c", { isComposing: true }), idle(), 0)
    ).toBeUndefined();
  });

  it("ignores everything while another modal is open", () => {
    const matcher = createShortcutMatcher();
    const context: ShortcutContext = { modal: "other", viewer: employee };
    expect(matcher.handle(key("c"), context, 0)).toBeUndefined();
    expect(matcher.handle(key("?"), context, 0)).toBeUndefined();
  });

  it("only allows task actions over the task drawer", () => {
    const matcher = createShortcutMatcher();
    const context: ShortcutContext = {
      modal: "task-drawer",
      viewer: { ...employee, taskDrawer: "editable" },
    };
    expect(matcher.handle(key("c"), context, 0)).toBeUndefined();
    expect(matcher.handle(key("a"), context, 0)?.id).toBe("assign-task");
    expect(matcher.handle(key("s"), context, 0)?.id).toBe("set-status");
  });

  it("does nothing for actions the viewer cannot do", () => {
    const matcher = createShortcutMatcher();
    const noProjects = idle({ ...employee, canCreateTask: false });
    expect(matcher.handle(key("c"), noProjects, 0)).toBeUndefined();
    expect(matcher.handle(key("a"), idle(), 0)).toBeUndefined();
    const readonly: ShortcutContext = {
      modal: "task-drawer",
      viewer: { ...employee, taskDrawer: "readonly" },
    };
    expect(matcher.handle(key("s"), readonly, 0)).toBeUndefined();
  });
});
