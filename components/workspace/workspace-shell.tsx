/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { Bell, List } from "@phosphor-icons/react";
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
import { WorkspaceBottomNavigation } from "@/components/workspace/workspace-bottom-navigation";
import { WorkspaceCreateMenu } from "@/components/workspace/workspace-create-menu";
import { WorkspaceLink } from "@/components/workspace/workspace-navigation";
import { sections } from "@/components/workspace/workspace-navigation-data";
import { WorkspaceSearchPalette } from "@/components/workspace/workspace-search-palette";
import { WorkspaceUndoProvider } from "@/components/workspace/workspace-undo";

export interface WorkspaceProject {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly icon: string;
}

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
          {section.items.flatMap(({ href, label, Icon }) => {
            if (href === "/bug-approvals" && role !== "admin") {
              return [];
            }
            return [
              <SheetClose asChild key={href}>
                <WorkspaceLink
                  active={pathname === href}
                  href={href}
                  Icon={Icon}
                  label={label}
                  unreadCount={unreadCountFor(label)}
                />
              </SheetClose>,
            ];
          })}
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
                <span aria-hidden="true" className="ws-logo" data-initial="M" />
                <span className="ws-name trunc">Metsys</span>
              </Link>
            </div>
            <div className="side-scroll">
              {sections.map((section) => (
                <div className="sgroup" key={section.label ?? "personal"}>
                  {section.label ? (
                    <div className="sgroup-h">{section.label}</div>
                  ) : null}
                  {section.items.flatMap(({ href, label, Icon }) => {
                    if (href === "/bug-approvals" && role !== "admin") {
                      return [];
                    }
                    return [
                      <WorkspaceLink
                        active={pathname === href}
                        href={href}
                        Icon={Icon}
                        key={href}
                        label={label}
                        unreadCount={unreadCountFor(label)}
                      />,
                    ];
                  })}
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
          <WorkspaceBottomNavigation
            mobileNavigation={mobileNavigation}
            name={name}
            pathname={pathname}
            role={role}
            unreadInboxCount={unreadInboxCount}
          />
        </div>
        <PushNotificationsControl publicKey={publicKey} />
        <span className="sr-only">Signed in as {name}</span>
      </WorkspaceUndoProvider>
    </div>
  );
};
