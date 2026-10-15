/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */
import Link from "next/link";
import type { ReactNode } from "react";

import { SheetClose } from "@/components/ui/sheet";
import { WorkspaceLink } from "@/components/workspace/workspace-navigation";
import {
  getNavigationTransitionType,
  isNavigationItemActive,
  sections,
} from "@/components/workspace/workspace-navigation-data";
import type { WorkspaceProject } from "@/components/workspace/workspace-shell";
import { ProjectIcon } from "@/features/projects/components/project-icon";

const NavigationEntry = ({
  children,
  closeOnNavigate,
}: {
  readonly children: ReactNode;
  readonly closeOnNavigate: boolean;
}) =>
  closeOnNavigate ? <SheetClose asChild>{children}</SheetClose> : children;

export const WorkspaceNavigationGroups = ({
  pathname,
  role,
  projects,
  unreadInboxCount,
  unreadNotificationCount,
  closeOnNavigate = false,
}: {
  readonly pathname: string;
  readonly role: "admin" | "employee";
  readonly projects: readonly WorkspaceProject[];
  readonly unreadInboxCount: number;
  readonly unreadNotificationCount: number;
  readonly closeOnNavigate?: boolean;
}) => {
  const activeProject = projects.find(
    ({ id }) =>
      pathname === `/projects/${id}` || pathname.startsWith(`/projects/${id}/`)
  );
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
                  active={
                    href === "/projects"
                      ? pathname === href
                      : isNavigationItemActive(pathname, href)
                  }
                  href={href}
                  Icon={Icon}
                  label={label}
                  transitionType={getNavigationTransitionType(pathname, href)}
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
            <Link
              aria-current={
                activeProject?.id === project.id ? "page" : undefined
              }
              className={`sitem${activeProject?.id === project.id ? " on" : ""}`}
              href={`/projects/${project.id}`}
              transitionTypes={[
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
            </Link>
          </NavigationEntry>
        ))}
      </div>
    </>
  );
};
