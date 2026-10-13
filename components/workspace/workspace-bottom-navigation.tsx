/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle -- Navigation uses reference workspace styles. */

"use client";

import { DotsThree, FolderOpen } from "@phosphor-icons/react";
import type { Route } from "next";
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
import { WorkspaceAccountMenu } from "@/components/workspace/workspace-account-menu";
import { mobileItems } from "@/components/workspace/workspace-navigation-data";

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
}) => (
  <nav aria-label="Primary" className="bottomnav">
    {mobileItems.map(({ href, label, Icon }) => (
      <Link
        aria-label={
          label === "Inbox" && unreadInboxCount > 0
            ? `Inbox ${unreadInboxCount > 99 ? "99+" : unreadInboxCount} unread`
            : undefined
        }
        aria-current={pathname === href ? "page" : undefined}
        className={pathname === href ? "on" : ""}
        href={href as Route}
        key={href}
      >
        <Icon aria-hidden="true" size={19} />
        <span>{label}</span>
        {label === "Inbox" && unreadInboxCount > 0 ? (
          <span aria-hidden="true" className="bdot" />
        ) : null}
      </Link>
    ))}
    <Link className={pathname === "/projects" ? "on" : ""} href="/projects">
      <FolderOpen aria-hidden="true" size={19} />
      <span>Projects</span>
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
          <SheetTitle>Metsys</SheetTitle>
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
