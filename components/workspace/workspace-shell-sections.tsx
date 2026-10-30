/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { Bell, GearSix, List, SidebarSimple } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { use, useState } from "react";

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
import { WorkspaceLink } from "@/components/workspace/workspace-navigation";
import {
  getNavigationTransitionType,
  isNavigationItemActive,
  sections,
} from "@/components/workspace/workspace-navigation-data";
import { WorkspaceNavigationGroups } from "@/components/workspace/workspace-navigation-groups";
import { WorkspaceSearchPalette } from "@/components/workspace/workspace-search-palette";
import type { WorkspaceFrameData } from "@/components/workspace/workspace-shell";

interface SectionProps {
  readonly framePromise: Promise<WorkspaceFrameData | null>;
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

const TOPBAR_FALLBACK_KEYS = ["t1", "t2", "t3"] as const;
const BOTTOM_FALLBACK_KEYS = ["b1", "b2", "b3", "b4", "b5"] as const;

// Holds the title's place until the URL is read on a dynamic route.
export const WorkspaceTopbarTitleFallback = () => (
  <span aria-hidden="true" className="workspace-loading-title" />
);

// Holds the phone menu button's place while the session data loads.
export const WorkspaceTopbarMenuFallback = () => (
  <Button
    aria-hidden="true"
    data-workspace-mobile-menu=""
    disabled
    size="icon-sm"
    tabIndex={-1}
    variant="ghost"
  >
    <List aria-hidden="true" size={18} />
  </Button>
);

// Mirrors the action buttons while the session data loads.
export const WorkspaceTopbarActionsFallback = () =>
  TOPBAR_FALLBACK_KEYS.map((key) => (
    <span aria-hidden="true" className="workspace-loading-action" key={key} />
  ));

// Mirrors the phone bottom navigation while the session data loads.
export const WorkspaceBottomChromeFallback = () => (
  <div aria-hidden="true" className="bottomnav">
    {BOTTOM_FALLBACK_KEYS.map((key) => (
      <span className="workspace-loading-tab" key={key} />
    ))}
  </div>
);

const MobileNavigation = ({ data }: { readonly data: WorkspaceFrameData }) => (
  <div className="mobile-navigation">
    <WorkspaceNavigationGroups
      closeOnNavigate
      role={data.role}
      projects={data.projects}
      unreadInboxCount={data.unreadInboxCount}
      unreadNotificationCount={data.unreadNotificationCount}
    />
  </div>
);

export const WorkspaceSidebar = ({ framePromise }: SectionProps) => {
  const data = use(framePromise);
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  if (!data) {
    return <WorkspaceSidebarFallback />;
  }
  return (
    <>
      <div className="side-top">
        <Link
          aria-label="Taskora home"
          className="ws"
          href="/"
          transitionTypes={[getNavigationTransitionType(pathname, "/")]}
        >
          <span aria-hidden="true" className="ws-logo" data-initial="M" />
          <span className="ws-name trunc">Taskora</span>
        </Link>
        <Button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          className="sidebar-collapse"
          onClick={() => setCollapsed(!collapsed)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <SidebarSimple aria-hidden="true" size={16} />
        </Button>
      </div>
      <div className="side-scroll">
        <WorkspaceNavigationGroups
          role={data.role}
          projects={data.projects}
          unreadInboxCount={data.unreadInboxCount}
          unreadNotificationCount={data.unreadNotificationCount}
        />
      </div>
      <div className="side-bot">
        <WorkspaceLink
          href="/settings"
          Icon={GearSix}
          isActive={(currentPath) =>
            isNavigationItemActive(currentPath, "/settings")
          }
          label="Settings"
          transitionTypes={(currentPath) => [
            getNavigationTransitionType(currentPath, "/settings"),
          ]}
        />
        <WorkspaceAccountMenu name={data.name} role={data.role} />
      </div>
    </>
  );
};

// Names the destination from the URL alone, so a deep link shows the right
// title on first paint. Only project pages wait on the frame, for the name.
export const WorkspaceTopbarTitle = ({ framePromise }: SectionProps) => {
  const pathname = usePathname();
  const [, segment, projectPathId] = pathname.split("/");
  const projectId = segment === "projects" ? projectPathId : undefined;
  const projectName = projectId
    ? use(framePromise)?.projects.find(({ id }) => id === projectId)?.name
    : undefined;
  const sectionLabel = sections
    .flatMap((section) => section.items)
    .find((link) => isNavigationItemActive(pathname, link.href))?.label;
  return (
    <span className="topbar-title">
      {projectName ?? sectionLabel ?? "Workspace"}
    </span>
  );
};

export const WorkspaceTopbarMenu = ({ framePromise }: SectionProps) => {
  const data = use(framePromise);
  if (!data) {
    return null;
  }
  return (
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
          <SheetTitle>Taskora</SheetTitle>
        </SheetHeader>
        <nav aria-label="Workspace" className="mobile-navigation-scroll">
          <MobileNavigation data={data} />
        </nav>
        <div className="mobile-navigation-footer">
          <WorkspaceAccountMenu name={data.name} role={data.role} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export const WorkspaceTopbarActions = ({ framePromise }: SectionProps) => {
  const data = use(framePromise);
  const pathname = usePathname();
  if (!data) {
    return null;
  }
  const { name, projects, role, unreadNotificationCount } = data;
  return (
    <>
      <WorkspaceSearchPalette projects={projects} role={role} />
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

export const WorkspaceBottomChrome = ({ framePromise }: SectionProps) => {
  const data = use(framePromise);
  const pathname = usePathname();
  if (!data) {
    return null;
  }
  return (
    <WorkspaceBottomNavigation
      mobileNavigation={<MobileNavigation data={data} />}
      name={data.name}
      pathname={pathname}
      role={data.role}
      unreadInboxCount={data.unreadInboxCount}
    />
  );
};
