/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle */

"use client";

import { Columns } from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkspaceButton } from "@/components/workspace/workspace-button";

import type { TaskTableColumnId } from "./task-table-columns";
import { HIDEABLE_COLUMNS } from "./task-table-columns";

// Lists only hideable columns; the task name and actions columns always show.
export const TaskTableColumnMenu = ({
  hidden,
  onHiddenChange,
}: {
  readonly hidden: readonly TaskTableColumnId[];
  readonly onHiddenChange: (hidden: readonly TaskTableColumnId[]) => void;
}) => {
  const hiddenSet = new Set(hidden);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <WorkspaceButton className="btn btn-sm" type="button">
          <Columns aria-hidden="true" size={14} />
          Columns
        </WorkspaceButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="workspace-menu"
        data-workspace-menu=""
      >
        {HIDEABLE_COLUMNS.map((column) => (
          <DropdownMenuCheckboxItem
            checked={!hiddenSet.has(column.id)}
            key={column.id}
            onCheckedChange={(visible) =>
              onHiddenChange(
                visible
                  ? hidden.filter((id) => id !== column.id)
                  : [...hidden, column.id]
              )
            }
            onSelect={(event) => event.preventDefault()}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
