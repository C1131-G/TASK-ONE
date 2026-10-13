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
  unreadCount = 0,
}: {
  readonly href: string;
  readonly label: string;
  readonly Icon: typeof House;
  readonly active: boolean;
  readonly unreadCount?: number;
}) => (
  <Link
    aria-label={unreadCount > 0 ? `${label}, ${unreadCount} unread` : undefined}
    aria-current={active ? "page" : undefined}
    className={`sitem${active ? " on" : ""}`}
    href={href as Route}
  >
    <Icon aria-hidden="true" size={16} weight={active ? "fill" : "regular"} />
    <span className="trunc">{label}</span>
    {unreadCount > 0 ? (
      <span aria-hidden="true" className="ct dotc">
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>
    ) : null}
  </Link>
);
