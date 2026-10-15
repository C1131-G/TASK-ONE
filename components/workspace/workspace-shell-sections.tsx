/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { Bell, List } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { use } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { WorkspaceAccountMenu } from "@/components/workspace/workspace-account-menu";
import { WorkspaceBottomNavigation } from "@/components/workspace/workspace-bottom-navigation";
import { WorkspaceCreateMenu } from "@/components/workspace/workspace-create-menu";
import {
  getNavigationTransitionType,
  isNavigationItemActive,
  sections,
} from "@/components/workspace/workspace-navigation-data";
import { WorkspaceNavigationGroups } from "@/components/workspace/workspace-navigation-groups";
import { WorkspaceSearchPalette } from "@/components/workspace/workspace-search-palette";
import type { WorkspaceFrameData } from "@/components/workspace/workspace-shell";

interface SectionProps {
  readonly frame: Promise<WorkspaceFrameData | null>;
}

const SIDEBAR_FALLBACK_KEYS = ["n1", "n2", "n3", "n4"] as const;

// Mirrors the sidebar while the session and navigation data load.
export const WorkspaceSidebarFallback = () => (
  <div aria-hidden="true" className="workspace-loading-sidebar">
    <div className="workspace-loading-brand" />
    {SIDEBAR_FALLBACK_KEYS.map((key) => (
      <div className="workspace-loading-nav" key={key} />
    ))}
  </div>
);

const MobileNavigation = ({
  data,
  pathname,
}: {
  readonly data: WorkspaceFrameData;
  readonly pathname: string;
}) => (
  <div className="mobile-navigation">
    <WorkspaceNavigationGroups
      closeOnNavigate
      pathname={pathname}
      role={data.role}
      projects={data.projects}
      unreadInboxCount={data.unreadInboxCount}
      unreadNotificationCount={data.unreadNotificationCount}
    />
  </div>
);

export const WorkspaceSidebar = ({ frame }: SectionProps) => {
  const data = use(frame);
  const pathname = usePathname();
  if (!data) {
    return <WorkspaceSidebarFallback />;
  }
  return (
    <>
      <div className="side-top">
        <Link
          aria-label="Metsys home"
          className="ws"
          href="/"
          transitionTypes={[getNavigationTransitionType(pathname, "/")]}
        >
          <span aria-hidden="true" className="ws-logo" data-initial="M" />
          <span className="ws-name trunc">Metsys</span>
        </Link>
      </div>
      <div className="side-scroll">
        <WorkspaceNavigationGroups
          pathname={pathname}
          role={data.role}
          projects={data.projects}
          unreadInboxCount={data.unreadInboxCount}
          unreadNotificationCount={data.unreadNotificationCount}
        />
      </div>
      <div className="side-bot">
        <WorkspaceAccountMenu name={data.name} role={data.role} />
      </div>
    </>
  );
};

export const WorkspaceTopbar = ({ frame }: SectionProps) => {
  const data = use(frame);
  const pathname = usePathname();
  if (!data) {
    return null;
  }
  const { name, projects, role, unreadNotificationCount } = data;
  const activeProject = projects.find(({ id }) => {
    const projectPath = `/projects/${id}`;
    return pathname === projectPath || pathname.startsWith(`${projectPath}/`);
  });
  const title =
    activeProject?.name ??
    sections
      .flatMap((section) => section.items)
      .find((link) => isNavigationItemActive(pathname, link.href))?.label ??
    "Workspace";
  return (
    <>
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
          <nav aria-label="Workspace" className="mobile-navigation-scroll">
            <MobileNavigation data={data} pathname={pathname} />
          </nav>
          <div className="mobile-navigation-footer">
            <WorkspaceAccountMenu name={name} role={role} />
          </div>
        </SheetContent>
      </Sheet>
      <span className="crumbs">
        <span className="topbar-title">{title}</span>
      </span>
      <span className="sp" />
      <WorkspaceSearchPalette projects={projects} />
      <Link
        aria-label={
          unreadNotificationCount > 0
            ? `Notifications, ${unreadNotificationCount} unread`
            : "Open notifications"
        }
        className="ibtn"
        href="/notifications"
        transitionTypes={[
          getNavigationTransitionType(pathname, "/notifications"),
        ]}
      >
        <Bell aria-hidden="true" size={16} />
        {unreadNotificationCount > 0 ? (
          <span aria-hidden="true" className="topbar-notification-dot" />
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
    </>
  );
};

export const WorkspaceBottomChrome = ({ frame }: SectionProps) => {
  const data = use(frame);
  const pathname = usePathname();
  if (!data) {
    return null;
  }
  return (
    <>
      <WorkspaceBottomNavigation
        mobileNavigation={<MobileNavigation data={data} pathname={pathname} />}
        name={data.name}
        pathname={pathname}
        role={data.role}
        unreadInboxCount={data.unreadInboxCount}
      />
      <span className="sr-only">Signed in as {data.name}</span>
    </>
  );
};
