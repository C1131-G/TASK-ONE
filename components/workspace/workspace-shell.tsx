/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import {
  Archive,
  Bell,
  CalendarBlank,
  ChartLineUp,
  CheckCircle,
  FolderOpen,
  Files,
  GearSix,
  House,
  Tray,
  ListChecks,
  List,
  DotsThree,
  SquaresFour,
  Star,
  UsersThree,
  Pulse as Activity,
} from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PushNotificationsControl } from "@/components/push-notifications-control";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ProjectIcon } from "@/components/workspace/project-icon";
import { WorkspaceAccountMenu } from "@/components/workspace/workspace-account-menu";
import { WorkspaceCreateMenu } from "@/components/workspace/workspace-create-menu";
import { WorkspaceSearchPalette } from "@/components/workspace/workspace-search-palette";
import { WorkspaceUndoProvider } from "@/components/workspace/workspace-undo";

export interface WorkspaceProject {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly icon: string;
}

const sections = [
  {
    items: [
      { Icon: House, href: "/", label: "Home" },
      { Icon: Tray, href: "/inbox", label: "Inbox" },
      { Icon: CheckCircle, href: "/my-tasks", label: "My Tasks" },
      { Icon: Star, href: "/favorites", label: "Favorites" },
      { Icon: Bell, href: "/notifications", label: "Notifications" },
    ],
  },
  {
    items: [
      { Icon: SquaresFour, href: "/overview", label: "Overview" },
      { Icon: FolderOpen, href: "/projects", label: "Projects" },
      { Icon: ListChecks, href: "/tasks", label: "Tasks" },
      { Icon: CalendarBlank, href: "/calendar", label: "Calendar" },
      { Icon: ChartLineUp, href: "/timeline", label: "Timeline" },
      { Icon: Files, href: "/files", label: "Files" },
      { Icon: UsersThree, href: "/members", label: "Members" },
      { Icon: Activity, href: "/activity", label: "Activity" },
      { Icon: UsersThree, href: "/teams", label: "Teams" },
      { Icon: Archive, href: "/archive", label: "Archive" },
      { Icon: GearSix, href: "/settings", label: "Settings" },
    ],
    label: "Workspace",
  },
];

const mobileItems = [
  { Icon: House, href: "/", label: "Home" },
  { Icon: CheckCircle, href: "/my-tasks", label: "My Tasks" },
  { Icon: Tray, href: "/inbox", label: "Inbox" },
];

const WorkspaceLink = ({
  href,
  label,
  Icon,
  active,
  unreadCount = 0,
}: {
  readonly href: string;
  readonly label: string;
  readonly Icon: typeof House;
  readonly active: boolean;
  readonly unreadCount?: number;
}) => (
  <Link
    aria-label={unreadCount > 0 ? `${label}, ${unreadCount} unread` : undefined}
    aria-current={active ? "page" : undefined}
    className={`sitem${active ? " on" : ""}`}
    href={href as Route}
  >
    <Icon aria-hidden="true" size={16} weight={active ? "fill" : "regular"} />
    <span className="trunc">{label}</span>
    {unreadCount > 0 ? (
      <span aria-hidden="true" className="ct dotc">
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>
    ) : null}
  </Link>
);

export const WorkspaceShell = ({
  children,
  name,
  role,
  projects,
  publicKey,
  unreadInboxCount,
  unreadNotificationCount,
}: {
  readonly children: ReactNode;
  readonly name: string;
  readonly role: "admin" | "employee";
  readonly projects: readonly WorkspaceProject[];
  readonly publicKey: string;
  readonly unreadInboxCount: number;
  readonly unreadNotificationCount: number;
}) => {
  const pathname = usePathname();
  const unreadCountFor = (label: string): number => {
    if (label === "Inbox") {
      return unreadInboxCount;
    }
    if (label === "Notifications") {
      return unreadNotificationCount;
    }
    return 0;
  };
  const activeProject = projects.find(({ id }) => {
    const projectPath = `/projects/${id}`;
    return pathname === projectPath || pathname.startsWith(`${projectPath}/`);
  });
  const title =
    activeProject?.name ??
    sections
      .flatMap((section) => section.items)
      .find((item) => item.href === pathname)?.label ??
    "Workspace";
  const mobileNavigation = (
    <div className="mobile-navigation">
      {sections.map((section) => (
        <div className="sgroup" key={section.label ?? "personal"}>
          {section.label ? (
            <div className="sgroup-h">{section.label}</div>
          ) : null}
          {section.items.map(({ href, label, Icon }) => (
            <SheetClose asChild key={href}>
              <WorkspaceLink
                active={pathname === href}
                href={href}
                Icon={Icon}
                label={label}
                unreadCount={unreadCountFor(label)}
              />
            </SheetClose>
          ))}
        </div>
      ))}
      <div className="sgroup">
        <div className="sgroup-h">Projects</div>
        {projects.map((project) => (
          <SheetClose asChild key={project.id}>
            <Link
              aria-current={
                activeProject?.id === project.id ? "page" : undefined
              }
              className={`sitem${activeProject?.id === project.id ? " on" : ""}`}
              href={`/projects/${project.id}` as Route}
            >
              <ProjectIcon
                color={project.color}
                icon={project.icon}
                size={13}
              />
              <span className="trunc">{project.name}</span>
            </Link>
          </SheetClose>
        ))}
      </div>
    </div>
  );
  return (
    <div className="workspace-app">
      <WorkspaceUndoProvider>
        <a className="skip" href="#main-content">
          Skip to content
        </a>
        <div className="shell">
          <nav aria-label="Main" className="side">
            <div className="side-top">
              <Link aria-label="Metsys home" className="ws" href="/">
                <span aria-hidden="true" className="ws-logo">
                  M
                </span>
                <span className="ws-name trunc">Metsys</span>
              </Link>
            </div>
            <div className="side-scroll">
              {sections.map((section) => (
                <div className="sgroup" key={section.label ?? "personal"}>
                  {section.label ? (
                    <div className="sgroup-h">{section.label}</div>
                  ) : null}
                  {section.items.map(({ href, label, Icon }) => (
                    <WorkspaceLink
                      active={pathname === href}
                      href={href}
                      Icon={Icon}
                      key={href}
                      label={label}
                      unreadCount={unreadCountFor(label)}
                    />
                  ))}
                </div>
              ))}
              <div className="sgroup" id="side-projects">
                <div className="sgroup-h">Projects</div>
                {projects.map((project) => (
                  <Link
                    aria-current={
                      activeProject?.id === project.id ? "page" : undefined
                    }
                    className={`sitem${activeProject?.id === project.id ? " on" : ""}`}
                    href={`/projects/${project.id}` as Route}
                    key={project.id}
                  >
                    <ProjectIcon
                      color={project.color}
                      icon={project.icon}
                      size={13}
                    />
                    <span className="trunc">{project.name}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="side-bot">
              <WorkspaceAccountMenu name={name} role={role} />
            </div>
          </nav>
          <main className="main">
            <header className="topbar">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    aria-label="Open workspace navigation"
                    data-workspace-mobile-menu=""
                    size="icon-sm"
                    variant="ghost"
                  >
                    <List aria-hidden="true" size={18} />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  className="workspace-app"
                  data-workspace-nav=""
                  data-workspace-sheet=""
                  side="left"
                >
                  <SheetHeader>
                    <SheetTitle>Metsys</SheetTitle>
                  </SheetHeader>
                  <nav
                    aria-label="Workspace"
                    className="mobile-navigation-scroll"
                  >
                    {mobileNavigation}
                  </nav>
                  <div className="mobile-navigation-footer">
                    <WorkspaceAccountMenu name={name} role={role} />
                  </div>
                </SheetContent>
              </Sheet>
              <span className="crumbs">{title}</span>
              <span className="sp" />
              <WorkspaceSearchPalette projects={projects} />
              <Link
                aria-label={
                  unreadNotificationCount > 0
                    ? `Notifications, ${unreadNotificationCount} unread`
                    : "Open notifications"
                }
                className="ibtn"
                href={"/notifications" as Route}
              >
                <Bell aria-hidden="true" size={16} />
                {unreadNotificationCount > 0 ? (
                  <span
                    aria-hidden="true"
                    className="topbar-notification-dot"
                  />
                ) : null}
              </Link>
              <WorkspaceCreateMenu
                isAdmin={role === "admin"}
                projects={projects.map(({ id, name: projectName }) => ({
                  id,
                  name: projectName,
                }))}
              />
              <WorkspaceAccountMenu name={name} role={role} />
            </header>
            <div className="content" id="main-content" tabIndex={-1}>
              {children}
            </div>
          </main>
          <nav aria-label="Primary" className="bottomnav">
            {mobileItems.map(({ href, label, Icon }) => (
              <Link
                aria-label={
                  label === "Inbox" && unreadInboxCount > 0
                    ? `Inbox, ${unreadInboxCount} unread`
                    : undefined
                }
                aria-current={pathname === href ? "page" : undefined}
                className={pathname === href ? "on" : ""}
                href={href as Route}
                key={href}
              >
                <Icon aria-hidden="true" size={19} />
                <span>{label}</span>
                {label === "Inbox" && unreadInboxCount > 0 ? (
                  <span aria-hidden="true" className="bdot" />
                ) : null}
              </Link>
            ))}
            <Link
              className={pathname === "/projects" ? "on" : ""}
              href="/projects"
            >
              <FolderOpen aria-hidden="true" size={19} />
              <span>Projects</span>
            </Link>
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  aria-label="More workspace pages"
                  data-workspace-more=""
                  size="icon-sm"
                  variant="ghost"
                >
                  <DotsThree aria-hidden="true" size={20} weight="bold" />
                  <span>More</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                className="workspace-app"
                data-workspace-nav=""
                data-workspace-sheet=""
                side="left"
              >
                <SheetHeader>
                  <SheetTitle>Metsys</SheetTitle>
                </SheetHeader>
                <nav
                  aria-label="Workspace"
                  className="mobile-navigation-scroll"
                >
                  {mobileNavigation}
                </nav>
                <div className="mobile-navigation-footer">
                  <WorkspaceAccountMenu name={name} role={role} />
                </div>
              </SheetContent>
            </Sheet>
          </nav>
        </div>
        <PushNotificationsControl publicKey={publicKey} />
        <span className="sr-only">Signed in as {name}</span>
      </WorkspaceUndoProvider>
    </div>
  );
};
