"use client";

import { CaretUpDown } from "@phosphor-icons/react";
import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const WorkspaceAccountMenu = ({
  name,
  role,
}: {
  readonly name: string;
  readonly role: "admin" | "employee";
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        aria-label={`Account menu for ${name}`}
        data-workspace-account=""
        type="button"
        variant="ghost"
      >
        <span aria-hidden="true" data-workspace-avatar="">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span data-workspace-account-name="">{name}</span>
        <CaretUpDown aria-hidden="true" size={14} />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      data-workspace-menu=""
      data-workspace-account-menu=""
      className="w-56"
      side="top"
    >
      <DropdownMenuLabel>
        <span data-workspace-account-label="">{name}</span>
        <span data-workspace-account-role="">{role}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href="/settings">Settings</Link>
      </DropdownMenuItem>
      <div data-workspace-account-signout="">
        <SignOutButton />
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
);

export { WorkspaceAccountMenu };
