"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in app/workspace-styles/portal.css. */

import { Bell, Bug, ListChecks, UserCircle } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { Route } from "next";
import type { ReactNode } from "react";

import { NavLink } from "@/components/workspace/nav-link";

interface NavItem {
  readonly href: Route;
  readonly icon: Icon;
  readonly label: string;
  readonly match: (path: string) => boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/portal",
    icon: ListChecks,
    label: "Company bugs",
    match: (path) => path === "/portal" || path.startsWith("/portal/bugs"),
  },
  {
    href: "/portal/new",
    icon: Bug,
    label: "Report bug",
    match: (path) => path === "/portal/new",
  },
  {
    href: "/portal/notifications",
    icon: Bell,
    label: "Notifications",
    match: (path) => path === "/portal/notifications",
  },
  {
    href: "/portal/account",
    icon: UserCircle,
    label: "Account",
    match: (path) => path === "/portal/account",
  },
];

// Each link marks itself active from the URL; until the URL is read it renders
// inactive. The unread badge streams in its own boundary, so the links never
// wait on the count.
const PortalNavLinks = ({
  notificationBadge,
}: {
  readonly notificationBadge: ReactNode;
}) => (
  <nav aria-label="Client portal" className="portal-nav">
    <ul>
      {NAV_ITEMS.map((item) => {
        const Glyph = item.icon;
        return (
          <li key={item.href}>
            <NavLink
              className="portal-nav-link"
              href={item.href}
              isActive={item.match}
            >
              {(active) => (
                <>
                  <Glyph
                    aria-hidden="true"
                    size={18}
                    weight={active ? "fill" : "regular"}
                  />
                  <span>{item.label}</span>
                  {item.href === "/portal/notifications"
                    ? notificationBadge
                    : null}
                </>
              )}
            </NavLink>
          </li>
        );
      })}
    </ul>
  </nav>
);

export { PortalNavLinks };
