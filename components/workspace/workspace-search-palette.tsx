/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle */

"use client";

import {
  Archive,
  Bell,
  CalendarBlank,
  ChartLineUp,
  CheckCircle,
  Files,
  FolderOpen,
  GearSix,
  House,
  ListChecks,
  MagnifyingGlass,
  Pulse,
  SquaresFour,
  Star,
  Tray,
  UsersThree,
} from "@phosphor-icons/react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

const pages = [
  { Icon: House, href: "/", label: "Home" },
  { Icon: Tray, href: "/inbox", label: "Inbox" },
  { Icon: CheckCircle, href: "/my-tasks", label: "My Tasks" },
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

const WorkspaceSearchPalette = ({
  projects,
}: {
  readonly projects: readonly {
    readonly color: string;
    readonly icon: string;
    readonly id: string;
    readonly name: string;
  }[];
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navigate = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href as Route);
  };

  return (
    <>
      <Button
        aria-label="Search and jump to a page or project"
        className="topsearch"
        data-workspace-search-trigger=""
        onClick={() => setOpen(true)}
        type="button"
        variant="outline"
      >
        <MagnifyingGlass aria-hidden="true" size={14} />
        <span className="lbltxt">Search or jump to…</span>
        <kbd className="kbd">Ctrl K</kbd>
      </Button>
      <CommandDialog
        description="Search workspace pages and projects, or open workspace search."
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
            placeholder="Search pages and projects…"
            value={query}
          />
          <CommandList>
            <CommandEmpty>No matching pages or projects.</CommandEmpty>
            <CommandGroup heading="Pages">
              {pages.map(({ href, Icon, label }) => (
                <CommandItem
                  key={href}
                  onSelect={() => navigate(href)}
                  value={`${label} ${href}`}
                >
                  <Icon aria-hidden="true" size={16} />
                  {label}
                  {pathname === href ? (
                    <CommandShortcut>Current</CommandShortcut>
                  ) : null}
                </CommandItem>
              ))}
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
    </>
  );
};

export { WorkspaceSearchPalette };
