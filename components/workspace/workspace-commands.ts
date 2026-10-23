// The workspace command registry and the keyboard rules that fire it. Pure, so
// the palette, the shortcut listener and the help dialog share one source.

import type { Route } from "next";

export type CommandId =
  | "create-task"
  | "assign-task"
  | "set-status"
  | "go-home"
  | "go-tasks"
  | "go-projects"
  | "go-inbox"
  | "go-my-time"
  | "go-workload"
  | "go-budgets"
  | "go-intake-forms"
  | "go-webhooks"
  | "go-github"
  | "new-project"
  | "invite-member"
  | "show-shortcuts";

export type CommandGroup = "Actions" | "Navigate" | "Help";

export interface WorkspaceCommand {
  readonly group: CommandGroup;
  readonly href?: Route;
  readonly id: CommandId;
  readonly keys: readonly string[];
  readonly label: string;
  // Task actions work on the open task, so they stay live over its drawer.
  readonly scope: "global" | "task";
}

export interface Viewer {
  readonly canCreateTask: boolean;
  readonly role: "admin" | "employee";
  // What the open task drawer, if any, lets this viewer do.
  readonly taskDrawer: "none" | "readonly" | "editable";
}

export type ModalState = "none" | "task-drawer" | "other";

export interface ShortcutContext {
  readonly modal: ModalState;
  readonly viewer: Viewer;
}

export interface ShortcutTarget {
  readonly isContentEditable?: boolean;
  readonly tagName?: string;
}

export interface ShortcutKeyEvent {
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly isComposing: boolean;
  readonly key: string;
  readonly metaKey: boolean;
  readonly repeat: boolean;
  readonly shiftKey: boolean;
  readonly target: ShortcutTarget | null;
}

interface CommandDefinition extends WorkspaceCommand {
  readonly isAvailable: (viewer: Viewer) => boolean;
}

const always = () => true;
const isAdmin = ({ role }: Viewer) => role === "admin";

const COMMANDS: readonly CommandDefinition[] = [
  {
    group: "Actions",
    id: "create-task",
    isAvailable: ({ canCreateTask }) => canCreateTask,
    keys: ["C"],
    label: "Create task",
    scope: "global",
  },
  {
    group: "Actions",
    id: "assign-task",
    isAvailable: ({ taskDrawer }) => taskDrawer === "editable",
    keys: ["A"],
    label: "Assign task",
    scope: "task",
  },
  {
    group: "Actions",
    id: "set-status",
    isAvailable: ({ taskDrawer }) => taskDrawer === "editable",
    keys: ["S"],
    label: "Set task status",
    scope: "task",
  },
  {
    group: "Actions",
    href: "/projects",
    id: "new-project",
    isAvailable: isAdmin,
    keys: [],
    label: "Create project",
    scope: "global",
  },
  {
    group: "Actions",
    href: "/members",
    id: "invite-member",
    isAvailable: isAdmin,
    keys: [],
    label: "Invite member",
    scope: "global",
  },
  {
    group: "Navigate",
    href: "/",
    id: "go-home",
    isAvailable: always,
    keys: ["G", "H"],
    label: "Go to Home",
    scope: "global",
  },
  {
    group: "Navigate",
    href: "/tasks",
    id: "go-tasks",
    isAvailable: always,
    keys: ["G", "T"],
    label: "Go to Tasks",
    scope: "global",
  },
  {
    group: "Navigate",
    href: "/projects",
    id: "go-projects",
    isAvailable: always,
    keys: ["G", "P"],
    label: "Go to Projects",
    scope: "global",
  },
  {
    group: "Navigate",
    href: "/inbox",
    id: "go-inbox",
    isAvailable: always,
    keys: ["G", "I"],
    label: "Go to Inbox",
    scope: "global",
  },
  {
    group: "Navigate",
    href: "/my-time",
    id: "go-my-time",
    isAvailable: always,
    keys: ["G", "M"],
    label: "Go to My Time",
    scope: "global",
  },
  {
    group: "Navigate",
    href: "/workload",
    id: "go-workload",
    isAvailable: always,
    keys: ["G", "W"],
    label: "Go to Workload",
    scope: "global",
  },
  {
    group: "Navigate",
    href: "/budgets",
    id: "go-budgets",
    isAvailable: isAdmin,
    keys: ["G", "B"],
    label: "Go to Budgets",
    scope: "global",
  },
  {
    group: "Navigate",
    href: "/settings?section=intake",
    id: "go-intake-forms",
    isAvailable: isAdmin,
    keys: [],
    label: "Go to Intake forms",
    scope: "global",
  },
  {
    group: "Navigate",
    href: "/settings/webhooks",
    id: "go-webhooks",
    isAvailable: isAdmin,
    keys: [],
    label: "Go to Webhooks",
    scope: "global",
  },
  {
    group: "Navigate",
    href: "/settings/github",
    id: "go-github",
    isAvailable: isAdmin,
    keys: [],
    label: "Go to GitHub",
    scope: "global",
  },
  {
    group: "Help",
    id: "show-shortcuts",
    isAvailable: always,
    keys: ["?"],
    label: "Keyboard shortcuts",
    scope: "global",
  },
];

// Hides what the viewer cannot do, so neither the palette nor a key offers it.
export const getAvailableCommands = (
  viewer: Viewer
): readonly WorkspaceCommand[] =>
  COMMANDS.flatMap(({ isAvailable, ...command }) =>
    isAvailable(viewer) ? [command] : []
  );

export const isPaletteToggle = (
  event: Pick<ShortcutKeyEvent, "ctrlKey" | "key" | "metaKey">,
  isMac: boolean
): boolean =>
  event.key.toLowerCase() === "k" &&
  (isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey);

const TYPING_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

export const isTypingTarget = (target: ShortcutTarget | null): boolean =>
  target !== null &&
  (target.isContentEditable === true ||
    TYPING_TAGS.has(target.tagName?.toUpperCase() ?? ""));

// The task drawer is a modal too, but task actions stay live over it.
export const readModalState = (
  openDialogs: readonly {
    readonly dataset: Readonly<Record<string, string | undefined>>;
  }[]
): ModalState => {
  if (openDialogs.length === 0) {
    return "none";
  }
  return openDialogs.every(({ dataset }) => dataset.taskDrawer !== undefined)
    ? "task-drawer"
    : "other";
};

const SEQUENCE_LEADER = "g";
const DEFAULT_SEQUENCE_WINDOW_MS = 1500;

const hasModifier = ({ altKey, ctrlKey, metaKey }: ShortcutKeyEvent) =>
  altKey || ctrlKey || metaKey;

export const createShortcutMatcher = ({
  sequenceWindowMs = DEFAULT_SEQUENCE_WINDOW_MS,
}: { readonly sequenceWindowMs?: number } = {}) => {
  let leaderPressedAt: number | undefined;

  const handle = (
    event: ShortcutKeyEvent,
    { modal, viewer }: ShortcutContext,
    now: number
  ): WorkspaceCommand | undefined => {
    if (isTypingTarget(event.target)) {
      leaderPressedAt = undefined;
      return undefined;
    }
    if (
      modal === "other" ||
      event.repeat ||
      event.isComposing ||
      hasModifier(event)
    ) {
      return undefined;
    }
    const key = event.key.toLowerCase();
    const inSequence =
      leaderPressedAt !== undefined &&
      now - leaderPressedAt <= sequenceWindowMs;
    leaderPressedAt = undefined;
    if (!inSequence && key === SEQUENCE_LEADER) {
      leaderPressedAt = now;
      return undefined;
    }
    return getAvailableCommands(viewer).find(
      (command) =>
        (modal === "none" || command.scope === "task") &&
        command.keys.length === (inSequence ? 2 : 1) &&
        command.keys.at(-1)?.toLowerCase() === key &&
        (!inSequence || command.keys[0]?.toLowerCase() === SEQUENCE_LEADER)
    );
  };

  return { handle };
};

export const getPaletteToggleKeys = (isMac: boolean): readonly string[] =>
  isMac ? ["⌘", "K"] : ["Ctrl", "K"];
