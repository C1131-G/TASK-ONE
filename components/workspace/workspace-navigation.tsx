"use client";

/* eslint-disable shadcn/no-unknown-classes -- Navigation uses reference workspace styles. */

import type { House } from "@phosphor-icons/react";
import type { Route } from "next";

import type { NavigationTransitionType } from "@/components/ui/page-transition";
import { NavLink } from "@/components/workspace/nav-link";

export const WorkspaceLink = ({
  href,
  label,
  Icon,
  isActive,
  transitionTypes,
  unreadCount = 0,
}: {
  readonly href: Route;
  readonly label: string;
  readonly Icon: typeof House;
  readonly isActive: (pathname: string) => boolean;
  readonly transitionTypes: (pathname: string) => NavigationTransitionType[];
  readonly unreadCount?: number;
}) => (
  <NavLink
    activeClassName="on"
    className="sitem"
    href={href}
    isActive={isActive}
    transitionTypes={transitionTypes}
  >
    {(active) => (
      <>
        <Icon
          aria-hidden="true"
          size={16}
          weight={active ? "fill" : "regular"}
        />
        <span className="trunc">{label}</span>
        {unreadCount > 0 ? (
          <>
            <span className="ct dotc">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
            <span className="sr-only">unread</span>
          </>
        ) : null}
      </>
    )}
  </NavLink>
);
