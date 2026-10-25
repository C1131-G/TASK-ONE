/**
 * The mobile navigation, re-declared from the web app's
 * components/workspace/workspace-navigation-data.ts with React Native icons.
 * The drift test pins labels, hrefs and admin-only flags against the web
 * file, so the two navigations cannot diverge.
 */

export interface MobileNavItem {
  readonly adminOnly?: boolean;
  readonly href: string;
  readonly icon: string;
  readonly label: string;
}

export interface MobileNavGroup {
  readonly items: readonly MobileNavItem[];
  readonly label?: string;
}

/** The bottom tabs, in order. */
export const mobileTabs: readonly MobileNavItem[] = [
  { href: "/", icon: "House", label: "Home" },
  { href: "/my-tasks", icon: "CheckCircle", label: "My Tasks" },
  { href: "/inbox", icon: "Tray", label: "Inbox" },
];

/** The More menu: every sidebar entry, grouped like the web sidebar. */
export const moreGroups: readonly MobileNavGroup[] = [
  {
    items: [
      { href: "/my-time", icon: "Clock", label: "My Time" },
      { href: "/favorites", icon: "Star", label: "Favorites" },
      { href: "/notifications", icon: "Bell", label: "Notifications" },
    ],
  },
  {
    items: [
      { href: "/overview", icon: "SquaresFour", label: "Overview" },
      { href: "/projects", icon: "FolderOpen", label: "Projects" },
      { href: "/tasks", icon: "ListChecks", label: "Tasks" },
      { href: "/bugs", icon: "Bug", label: "Bugs" },
      { adminOnly: true, href: "/bug-approvals", icon: "CheckCircle", label: "Bug approvals" },
      { href: "/calendar", icon: "CalendarBlank", label: "Calendar" },
      { href: "/timeline", icon: "ChartLineUp", label: "Timeline" },
      { href: "/workload", icon: "Scales", label: "Workload" },
      { href: "/files", icon: "Files", label: "Files" },
      { adminOnly: true, href: "/budgets", icon: "Gauge", label: "Budgets" },
      { href: "/members", icon: "UsersThree", label: "Members" },
      { href: "/activity", icon: "Pulse", label: "Activity" },
      { href: "/teams", icon: "UsersThree", label: "Teams" },
      { adminOnly: true, href: "/clients", icon: "Buildings", label: "Clients" },
      { href: "/archive", icon: "Archive", label: "Archive" },
      { href: "/settings", icon: "GearSix", label: "Settings" },
    ],
    label: "Workspace",
  },
];

export const isActiveHref = (pathname: string, href: string): boolean =>
  href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
