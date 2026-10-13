"use client";

import { Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuickTaskForm } from "@/features/tasks/components/quick-task-form";

const WorkspaceCreateMenu = ({
  isAdmin,
  projects,
}: {
  readonly isAdmin: boolean;
  readonly projects: readonly { readonly id: string; readonly name: string }[];
}) => {
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            data-workspace-create=""
            size="sm"
            type="button"
            variant="default"
          >
            <Plus aria-hidden="true" size={15} />
            New
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" data-workspace-menu="">
          <DropdownMenuItem
            disabled={projects.length === 0}
            onSelect={() => setTaskDialogOpen(true)}
          >
            New task
          </DropdownMenuItem>
          {isAdmin ? (
            <>
              <DropdownMenuItem asChild>
                <Link href="/projects">New project</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/members">Invite member</Link>
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <QuickTaskForm
        onOpenChange={setTaskDialogOpen}
        open={taskDialogOpen}
        projects={projects}
        trigger={null}
      />
    </>
  );
};

export { WorkspaceCreateMenu };
