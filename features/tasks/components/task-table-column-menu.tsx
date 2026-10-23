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

import type {
  TaskTableColumnDef,
  TaskTableColumnId,
} from "../task-table-columns";
import { HIDEABLE_COLUMNS } from "../task-table-columns";

// Lists only hideable columns; the task name and actions columns always show.
export const TaskTableColumnMenu = ({
  columns = HIDEABLE_COLUMNS,
  hidden,
  onHiddenChange,
}: {
  readonly columns?: readonly TaskTableColumnDef[];
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
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            checked={
              hiddenSet.has(column.id) === (column.hiddenByDefault ?? false)
            }
            key={column.id}
            onCheckedChange={(visible) =>
              // The list holds columns that differ from their default.
              onHiddenChange(
                visible === (column.hiddenByDefault ?? false)
                  ? [...hidden, column.id]
                  : hidden.filter((id) => id !== column.id)
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
