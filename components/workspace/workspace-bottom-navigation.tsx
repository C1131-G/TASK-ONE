/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle -- Navigation uses reference workspace styles. */

"use client";

import { DotsThree, FolderOpen } from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavigationPendingIndicator } from "@/components/workspace/navigation-pending-indicator";
import { WorkspaceAccountMenu } from "@/components/workspace/workspace-account-menu";
import {
  getNavigationTransitionType,
  isNavigationItemActive,
  mobileItems,
} from "@/components/workspace/workspace-navigation-data";

export const WorkspaceBottomNavigation = ({
  mobileNavigation,
  name,
  pathname,
  role,
  unreadInboxCount,
}: {
  readonly mobileNavigation: ReactNode;
  readonly name: string;
  readonly pathname: string;
  readonly role: "admin" | "employee";
  readonly unreadInboxCount: number;
}) => {
  // Detail pages (/projects/1, /inbox/…) keep their section highlighted.
  const projectsActive = isNavigationItemActive(pathname, "/projects");
  return (
    <nav aria-label="Primary" className="bottomnav">
      {mobileItems.map(({ href, label, Icon }) => {
        const active = isNavigationItemActive(pathname, href);
        return (
          <Link
            aria-label={
              label === "Inbox" && unreadInboxCount > 0
                ? `Inbox ${unreadInboxCount > 99 ? "99+" : unreadInboxCount} unread`
                : undefined
            }
            aria-current={active ? "page" : undefined}
            className={active ? "on" : ""}
            href={href}
            key={href}
            transitionTypes={[getNavigationTransitionType(pathname, href)]}
          >
            <Icon aria-hidden="true" size={19} />
            <span>{label}</span>
            <NavigationPendingIndicator />
            {label === "Inbox" && unreadInboxCount > 0 ? (
              <span aria-hidden="true" className="bdot" />
            ) : null}
          </Link>
        );
      })}
      <Link
        aria-current={projectsActive ? "page" : undefined}
        className={projectsActive ? "on" : ""}
        href="/projects"
        transitionTypes={[getNavigationTransitionType(pathname, "/projects")]}
      >
        <FolderOpen aria-hidden="true" size={19} />
        <span>Projects</span>
        <NavigationPendingIndicator />
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
            <SheetTitle>Taskora</SheetTitle>
          </SheetHeader>
          <nav aria-label="Workspace" className="mobile-navigation-scroll">
            {mobileNavigation}
          </nav>
          <div className="mobile-navigation-footer">
            <WorkspaceAccountMenu name={name} role={role} />
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
};
