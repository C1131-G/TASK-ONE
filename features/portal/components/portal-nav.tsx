"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in app/workspace-styles/portal.css. */

import { Bell, Bug, ListChecks, UserCircle } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

const PortalNav = ({ unreadCount }: { readonly unreadCount: number }) => {
  const pathname = usePathname();
  return (
    <nav aria-label="Client portal" className="portal-nav">
      <ul>
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          const Glyph = item.icon;
          const isNotifications = item.href === "/portal/notifications";
          return (
            <li key={item.href}>
              <Link
                aria-current={active ? "page" : undefined}
                className="portal-nav-link"
                href={item.href}
              >
                <Glyph
                  aria-hidden="true"
                  size={18}
                  weight={active ? "fill" : "regular"}
                />
                <span>{item.label}</span>
                {isNotifications && unreadCount > 0 ? (
                  <span className="portal-nav-badge">
                    <span aria-hidden="true">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                    <span className="sr-only">{unreadCount} unread</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export { PortalNav };
