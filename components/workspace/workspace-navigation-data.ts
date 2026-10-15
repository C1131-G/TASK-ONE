import {
  Archive,
  Bell,
  Bug,
  Buildings,
  CalendarBlank,
  ChartLineUp,
  CheckCircle,
  Files,
  FolderOpen,
  GearSix,
  House,
  ListChecks,
  SquaresFour,
  Star,
  Tray,
  UsersThree,
  Pulse as Activity,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { Route } from "next";

interface NavigationItem {
  // Admin-only pages are hidden from other roles; the pages also gate access.
  readonly adminOnly?: boolean;
  readonly Icon: Icon;
  readonly href: Route;
  readonly label: string;
}

interface NavigationSection {
  readonly items: readonly NavigationItem[];
  readonly label?: string;
}

export const sections: readonly NavigationSection[] = [
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
      { Icon: Bug, href: "/bugs", label: "Bugs" },
      {
        Icon: CheckCircle,
        adminOnly: true,
        href: "/bug-approvals",
        label: "Bug approvals",
      },
      { Icon: CalendarBlank, href: "/calendar", label: "Calendar" },
      { Icon: ChartLineUp, href: "/timeline", label: "Timeline" },
      { Icon: Files, href: "/files", label: "Files" },
      { Icon: UsersThree, href: "/members", label: "Members" },
      { Icon: Activity, href: "/activity", label: "Activity" },
      { Icon: UsersThree, href: "/teams", label: "Teams" },
      { Icon: Buildings, adminOnly: true, href: "/clients", label: "Clients" },
      { Icon: Archive, href: "/archive", label: "Archive" },
      { Icon: GearSix, href: "/settings", label: "Settings" },
    ],
    label: "Workspace",
  },
];

export const mobileItems: readonly NavigationItem[] = [
  { Icon: House, href: "/", label: "Home" },
  { Icon: CheckCircle, href: "/my-tasks", label: "My Tasks" },
  { Icon: Tray, href: "/inbox", label: "Inbox" },
];

export const isNavigationItemActive = (
  pathname: string,
  href: Route
): boolean =>
  href === "/"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

export const getNavigationTransitionType = (
  pathname: string,
  href: string
): "nav-back" | "nav-forward" =>
  pathname !== href && (href === "/" || pathname.startsWith(`${href}/`))
    ? "nav-back"
    : "nav-forward";
