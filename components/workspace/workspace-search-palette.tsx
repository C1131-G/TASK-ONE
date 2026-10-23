/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle */

"use client";

import {
  Archive,
  Bell,
  CalendarBlank,
  ChartLineUp,
  CheckCircle,
  Clock,
  Files,
  FolderOpen,
  Gauge,
  GearSix,
  GithubLogo,
  House,
  Keyboard,
  ListChecks,
  MagnifyingGlass,
  Plus,
  Pulse,
  Scales,
  SquaresFour,
  Star,
  Tray,
  UserPlus,
  UsersThree,
  WebhooksLogo,
} from "@phosphor-icons/react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  readViewer,
  useIsMac,
  useWorkspaceShortcuts,
} from "@/components/workspace/use-workspace-shortcuts";
import {
  getAvailableCommands,
  getPaletteToggleKeys,
} from "@/components/workspace/workspace-commands";
import type {
  CommandId,
  Viewer,
  WorkspaceCommand,
} from "@/components/workspace/workspace-commands";
import { getNavigationTransitionType } from "@/components/workspace/workspace-navigation-data";
import {
  ShortcutKeys,
  WorkspaceShortcutsHelp,
} from "@/components/workspace/workspace-shortcuts-help";
import { QuickTaskForm } from "@/features/tasks/components/quick-task-form";

const pages = [
  { Icon: House, href: "/", label: "Home" },
  { Icon: Tray, href: "/inbox", label: "Inbox" },
  { Icon: CheckCircle, href: "/my-tasks", label: "My Tasks" },
  { Icon: Clock, href: "/my-time", label: "My Time" },
  { Icon: Star, href: "/favorites", label: "Favorites" },
  { Icon: SquaresFour, href: "/overview", label: "Overview" },
  { Icon: FolderOpen, href: "/projects", label: "Projects" },
  { Icon: ListChecks, href: "/tasks", label: "Tasks" },
  { Icon: CalendarBlank, href: "/calendar", label: "Calendar" },
  { Icon: ChartLineUp, href: "/timeline", label: "Timeline" },
  { Icon: Files, href: "/files", label: "Files" },
  { Icon: UsersThree, href: "/members", label: "Members" },
  { Icon: Pulse, href: "/activity", label: "Activity" },
  { Icon: UsersThree, href: "/teams", label: "Teams" },
  { Icon: Bell, href: "/notifications", label: "Notifications" },
  { Icon: Archive, href: "/archive", label: "Archive" },
  { Icon: GearSix, href: "/settings", label: "Settings" },
] as const;

const COMMAND_ICONS = {
  "assign-task": UsersThree,
  "create-task": Plus,
  "go-budgets": Gauge,
  "go-github": GithubLogo,
  "go-home": House,
  "go-inbox": Tray,
  "go-intake-forms": Tray,
  "go-my-time": Clock,
  "go-projects": FolderOpen,
  "go-tasks": ListChecks,
  "go-webhooks": WebhooksLogo,
  "go-workload": Scales,
  "invite-member": UserPlus,
  "new-project": FolderOpen,
  "set-status": CheckCircle,
  "show-shortcuts": Keyboard,
} as const satisfies Record<CommandId, unknown>;

// Task actions land on a control inside the open task drawer.
const TASK_CONTROL_SELECTORS = {
  "assign-task": '[data-task-drawer] [id$="-assignee-search"]',
  "set-status": '[data-task-drawer] [id$="-status"]',
} as const;

type TaskControlId = keyof typeof TASK_CONTROL_SELECTORS;

const focusTaskControl = (id: TaskControlId) => {
  const control = document.querySelector(TASK_CONTROL_SELECTORS[id]);
  if (control instanceof HTMLElement) {
    control.focus();
  }
};

const isTaskControlId = (id: CommandId): id is TaskControlId =>
  id in TASK_CONTROL_SELECTORS;

// Navigation commands that have a "Go to" key show it beside their page below.
const isPageShortcut = (command: WorkspaceCommand) =>
  command.group === "Navigate";

const GO_TO_PREFIX = /^Go to /u;
const listedHrefs = new Set<string>(pages.map(({ href }) => href));

const WorkspaceSearchPalette = ({
  projects,
  role,
}: {
  readonly projects: readonly {
    readonly color: string;
    readonly icon: string;
    readonly id: string;
    readonly name: string;
  }[];
  readonly role: Viewer["role"];
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskDrawer, setTaskDrawer] = useState<Viewer["taskDrawer"]>("none");
  // A task action picked in the palette focuses its control once the palette
  // has handed focus back, so the dialog's own restore does not win.
  const pendingFocus = useRef<TaskControlId | null>(null);
  const isMac = useIsMac();
  const base = { canCreateTask: projects.length > 0, role };
  const viewer: Viewer = { ...base, taskDrawer };
  const commands = getAvailableCommands(viewer);
  const keysByHref = new Map(
    commands.flatMap(({ href, keys }) =>
      href && keys.length > 0 ? [[href, keys] as const] : []
    )
  );
  // Pages the viewer may open that the fixed list above does not carry.
  const extraPages = commands.filter(
    (command) =>
      command.href !== undefined &&
      isPageShortcut(command) &&
      !listedHrefs.has(command.href)
  );
  const toggleKeys = getPaletteToggleKeys(isMac);

  const openPalette = () => {
    setTaskDrawer(readViewer(base).taskDrawer);
    setOpen(true);
  };

  const navigate = <Href extends string>(href: Route<Href>) => {
    setOpen(false);
    setQuery("");
    router.push(href, {
      transitionTypes: [getNavigationTransitionType(pathname, href)],
    });
  };

  const run = (command: WorkspaceCommand) => {
    if (command.href) {
      navigate(command.href);
      return;
    }
    setOpen(false);
    setQuery("");
    if (command.id === "create-task") {
      setTaskFormOpen(true);
    } else if (command.id === "show-shortcuts") {
      setHelpOpen(true);
    } else if (isTaskControlId(command.id)) {
      if (open) {
        pendingFocus.current = command.id;
      } else {
        focusTaskControl(command.id);
      }
    }
  };

  useWorkspaceShortcuts({
    base,
    isMac,
    onRun: run,
    onTogglePalette: () => (open ? setOpen(false) : openPalette()),
  });

  const commandGroups = (["Actions", "Help"] as const).map((group) => ({
    commands: commands.filter(
      (command) => command.group === group && !isPageShortcut(command)
    ),
    group,
  }));

  return (
    <>
      <Button
        aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
        aria-label="Search and jump to a page or project"
        className="topsearch"
        data-workspace-search-trigger=""
        onClick={openPalette}
        type="button"
        variant="outline"
      >
        <MagnifyingGlass aria-hidden="true" size={14} />
        <span className="lbltxt">Search or jump to…</span>
        <kbd className="kbd">{toggleKeys.join(" ")}</kbd>
      </Button>
      <CommandDialog
        description="Search workspace pages and projects, run a command, or open workspace search."
        onCloseAutoFocus={(event) => {
          const pending = pendingFocus.current;
          pendingFocus.current = null;
          if (pending) {
            event.preventDefault();
            focusTaskControl(pending);
          }
        }}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setQuery("");
          }
        }}
        open={open}
        title="Search or jump to"
        workspace
      >
        <Command>
          <CommandInput
            onValueChange={setQuery}
            placeholder="Search commands, pages and projects…"
            value={query}
          />
          <CommandList>
            <CommandEmpty>
              No matching commands, pages or projects.
            </CommandEmpty>
            {commandGroups.map(({ commands: groupCommands, group }) =>
              groupCommands.length ? (
                <CommandGroup heading={group} key={group}>
                  {groupCommands.map((command) => {
                    const Icon = COMMAND_ICONS[command.id];
                    return (
                      <CommandItem
                        key={command.id}
                        onSelect={() => run(command)}
                        value={`${command.label} ${command.id}`}
                      >
                        <Icon aria-hidden="true" size={16} />
                        {command.label}
                        {command.keys.length ? (
                          <CommandShortcut>
                            <ShortcutKeys keys={command.keys} />
                          </CommandShortcut>
                        ) : null}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ) : null
            )}
            <CommandGroup heading="Pages">
              {pages.map(({ href, Icon, label }) => (
                <CommandItem
                  key={href}
                  onSelect={() => navigate(href)}
                  value={`${label} ${href}`}
                >
                  <Icon aria-hidden="true" size={16} />
                  {label}
                  <CommandShortcut>
                    {pathname === href ? (
                      <span className="mr-2">Current</span>
                    ) : null}
                    <ShortcutKeys keys={keysByHref.get(href) ?? []} />
                  </CommandShortcut>
                </CommandItem>
              ))}
              {extraPages.map((command) => {
                const Icon = COMMAND_ICONS[command.id];
                const { href } = command;
                return href ? (
                  <CommandItem
                    key={command.id}
                    onSelect={() => navigate(href)}
                    value={`${command.label} ${href}`}
                  >
                    <Icon aria-hidden="true" size={16} />
                    {command.label.replace(GO_TO_PREFIX, "")}
                    <CommandShortcut>
                      {pathname === href ? (
                        <span className="mr-2">Current</span>
                      ) : null}
                      <ShortcutKeys keys={command.keys} />
                    </CommandShortcut>
                  </CommandItem>
                ) : null;
              })}
            </CommandGroup>
            {projects.length ? (
              <CommandGroup heading="Projects">
                {projects.map((project) => (
                  <CommandItem
                    key={project.id}
                    onSelect={() => navigate(`/projects/${project.id}`)}
                    value={`${project.name} ${project.id}`}
                  >
                    <FolderOpen aria-hidden="true" size={16} />
                    {project.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {query.trim() ? (
              <CommandGroup heading="Search">
                <CommandItem
                  onSelect={() =>
                    navigate(`/search?q=${encodeURIComponent(query.trim())}`)
                  }
                  value={`search ${query}`}
                >
                  <MagnifyingGlass aria-hidden="true" size={16} />
                  Search workspace for “{query.trim()}”
                  <CommandShortcut>Enter</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
      <WorkspaceShortcutsHelp
        isMac={isMac}
        onOpenChange={setHelpOpen}
        open={helpOpen}
        viewer={viewer}
      />
      <QuickTaskForm
        onOpenChange={setTaskFormOpen}
        open={taskFormOpen}
        projects={projects}
        trigger={null}
      />
    </>
  );
};

export { WorkspaceSearchPalette };
