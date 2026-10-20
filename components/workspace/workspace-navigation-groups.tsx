/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */
import type { Route } from "next";
import type { ReactNode } from "react";

import { SheetClose } from "@/components/ui/sheet";
import { NavLink } from "@/components/workspace/nav-link";
import { WorkspaceLink } from "@/components/workspace/workspace-navigation";
import {
  getNavigationTransitionType,
  isNavigationItemActive,
  sections,
} from "@/components/workspace/workspace-navigation-data";
import type { WorkspaceProject } from "@/components/workspace/workspace-shell";
import { ProjectIcon } from "@/features/projects/components/project-icon";

const isProjectPath = (pathname: string, projectId: string) =>
  pathname === `/projects/${projectId}` ||
  pathname.startsWith(`/projects/${projectId}/`);

const NavigationEntry = ({
  children,
  closeOnNavigate,
}: {
  readonly children: ReactNode;
  readonly closeOnNavigate: boolean;
}) =>
  closeOnNavigate ? <SheetClose asChild>{children}</SheetClose> : children;

export const WorkspaceNavigationGroups = ({
  role,
  projects,
  unreadInboxCount,
  unreadNotificationCount,
  closeOnNavigate = false,
}: {
  readonly role: "admin" | "employee";
  readonly projects: readonly WorkspaceProject[];
  readonly unreadInboxCount: number;
  readonly unreadNotificationCount: number;
  readonly closeOnNavigate?: boolean;
}) => {
  const unreadCountFor = (label: string): number => {
    if (label === "Inbox") {
      return unreadInboxCount;
    }
    if (label === "Notifications") {
      return unreadNotificationCount;
    }
    return 0;
  };
  return (
    <>
      {sections.map((section) => (
        <div className="sgroup" key={section.label ?? "personal"}>
          {section.label ? (
            <div className="sgroup-h">{section.label}</div>
          ) : null}
          {section.items.flatMap(({ adminOnly, href, label, Icon }) => {
            if (adminOnly && role !== "admin") {
              return [];
            }
            return [
              <NavigationEntry closeOnNavigate={closeOnNavigate} key={href}>
                <WorkspaceLink
                  href={href}
                  Icon={Icon}
                  isActive={(pathname) =>
                    href === "/projects"
                      ? pathname === href
                      : isNavigationItemActive(pathname, href)
                  }
                  label={label}
                  transitionTypes={(pathname) => [
                    getNavigationTransitionType(pathname, href),
                  ]}
                  unreadCount={unreadCountFor(label)}
                />
              </NavigationEntry>,
            ];
          })}
        </div>
      ))}
      <div
        className="sgroup"
        id={closeOnNavigate ? undefined : "side-projects"}
      >
        <div className="sgroup-h">Projects</div>
        {projects.map((project) => (
          <NavigationEntry closeOnNavigate={closeOnNavigate} key={project.id}>
            <NavLink
              activeClassName="on"
              className="sitem"
              // A project id from the shell data names an existing project route.
              href={`/projects/${project.id}` as Route}
              isActive={(pathname) => isProjectPath(pathname, project.id)}
              transitionTypes={(pathname) => [
                getNavigationTransitionType(
                  pathname,
                  `/projects/${project.id}`
                ),
              ]}
            >
              <ProjectIcon
                color={project.color}
                icon={project.icon}
                size={13}
              />
              <span className="trunc">{project.name}</span>
            </NavLink>
          </NavigationEntry>
        ))}
      </div>
    </>
  );
};
