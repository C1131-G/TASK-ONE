/* eslint-disable shadcn/no-unknown-classes */

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
  MagnifyingGlass,
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
import { SignOutButton } from "@/components/sign-out-button";
import { ProjectIcon } from "@/components/workspace/project-icon";

interface WorkspaceProject {
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
}: {
  readonly href: string;
  readonly label: string;
  readonly Icon: typeof House;
  readonly active: boolean;
}) => (
  <Link
    aria-current={active ? "page" : undefined}
    className={`sitem${active ? " on" : ""}`}
    href={href as Route}
  >
    <Icon aria-hidden="true" size={16} weight={active ? "fill" : "regular"} />
    <span className="trunc">{label}</span>
  </Link>
);

export const WorkspaceShell = ({
  children,
  name,
  role,
  projects,
  publicKey,
}: {
  readonly children: ReactNode;
  readonly name: string;
  readonly role: "admin" | "employee";
  readonly projects: readonly WorkspaceProject[];
  readonly publicKey: string;
}) => {
  const pathname = usePathname();
  const title =
    sections
      .flatMap((section) => section.items)
      .find((item) => item.href === pathname)?.label ?? "Workspace";
  return (
    <div className="workspace-app">
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
                  />
                ))}
              </div>
            ))}
            <div className="sgroup" id="side-projects">
              <div className="sgroup-h">Projects</div>
              {projects.map((project) => (
                <Link
                  className={`sitem${pathname === `/projects/${project.id}` ? " on" : ""}`}
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
            <div className="sitem" title={`${name} · ${role}`}>
              <span aria-hidden="true" className="av">
                {name.slice(0, 1).toUpperCase()}
              </span>
              <span className="trunc">{name}</span>
              <SignOutButton />
            </div>
          </div>
        </nav>
        <main className="main">
          <header className="topbar">
            <span className="crumbs">{title}</span>
            <span className="sp" />
            <Link
              aria-label="Search workspace"
              className="topsearch"
              href={"/search" as Route}
            >
              <MagnifyingGlass aria-hidden="true" size={14} />
              <span className="lbltxt">Search workspace</span>
            </Link>
            <Link
              aria-label="Open notifications"
              className="ibtn"
              href={"/notifications" as Route}
            >
              <Bell aria-hidden="true" size={16} />
            </Link>
          </header>
          <div className="content" id="main-content" tabIndex={-1}>
            {children}
          </div>
        </main>
        <nav aria-label="Primary" className="bottomnav">
          {mobileItems.map(({ href, label, Icon }) => (
            <Link
              aria-current={pathname === href ? "page" : undefined}
              className={pathname === href ? "on" : ""}
              href={href as Route}
              key={href}
            >
              <Icon aria-hidden="true" size={19} />
              <span>{label}</span>
            </Link>
          ))}
          <Link
            className={pathname === "/projects" ? "on" : ""}
            href="/projects"
          >
            <FolderOpen aria-hidden="true" size={19} />
            <span>Projects</span>
          </Link>
        </nav>
      </div>
      <PushNotificationsControl publicKey={publicKey} />
      <span className="sr-only">Signed in as {name}</span>
    </div>
  );
};
