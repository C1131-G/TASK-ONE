"use client";

/* eslint-disable shadcn/no-unknown-classes -- Navigation uses reference workspace styles. */

import type { House } from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";

export const WorkspaceLink = ({
  href,
  label,
  Icon,
  active,
  transitionType,
  unreadCount = 0,
}: {
  readonly href: Route;
  readonly label: string;
  readonly Icon: typeof House;
  readonly active: boolean;
  readonly transitionType: "nav-back" | "nav-forward";
  readonly unreadCount?: number;
}) => (
  <Link
    aria-current={active ? "page" : undefined}
    className={`sitem${active ? " on" : ""}`}
    href={href}
    transitionTypes={[transitionType]}
  >
    <Icon aria-hidden="true" size={16} weight={active ? "fill" : "regular"} />
    <span className="trunc">{label}</span>
    {unreadCount > 0 ? (
      <>
        <span className="ct dotc">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
        <span className="sr-only">unread</span>
      </>
    ) : null}
  </Link>
);
