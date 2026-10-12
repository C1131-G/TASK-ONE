/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle, shadcn/no-inline-styles */
// The column splitter must stay focusable, which an hr cannot be, so it keeps role="separator".
// eslint-disable jsx-a11y/prefer-tag-over-role

"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { useRef } from "react";

import { TableHead } from "@/components/ui/table";

import type { TaskTableColumn, TaskTableColumnId } from "./task-table-columns";
import { clampColumnWidth } from "./task-table-columns";

const KEYBOARD_RESIZE_STEP = 8;
const MAX_WIDTH_FOR_ARIA = 800;

export const TaskTableHeaderCell = ({
  activeSort,
  column,
  onResize,
  onSort,
  width,
}: {
  readonly activeSort: string;
  readonly column: TaskTableColumn;
  readonly onResize: (columnId: TaskTableColumnId, width: number) => void;
  readonly onSort: (field: string) => void;
  readonly width: number;
}) => {
  const dragStart = useRef<{
    readonly pointerX: number;
    readonly width: number;
  } | null>(null);
  const isSorted = column.sortField !== null && activeSort === column.sortField;
  const ariaSort = isSorted ? "ascending" : "none";

  const startDrag = (event: PointerEvent<HTMLSpanElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { pointerX: event.clientX, width };
  };
  const moveDrag = (event: PointerEvent<HTMLSpanElement>) => {
    const start = dragStart.current;
    if (start) {
      onResize(column.id, start.width + event.clientX - start.pointerX);
    }
  };
  const endDrag = () => {
    dragStart.current = null;
  };
  const resizeWithKeyboard = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onResize(column.id, width - KEYBOARD_RESIZE_STEP);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onResize(column.id, width + KEYBOARD_RESIZE_STEP);
    }
  };

  return (
    <TableHead
      aria-sort={column.sortField ? ariaSort : undefined}
      className="project-task-th"
      data-column={column.id}
      style={{ width: clampColumnWidth(column.id, width) }}
    >
      <span className="project-task-th-inner">
        {column.sortField ? (
          <button
            className="project-task-sort"
            onClick={() => onSort(column.sortField ?? "manual")}
            type="button"
          >
            {column.label}
            {isSorted ? <span aria-hidden="true"> ↑</span> : null}
          </button>
        ) : (
          column.label
        )}
      </span>
      <span
        aria-label={`Resize ${column.label} column`}
        aria-orientation="vertical"
        aria-valuemax={MAX_WIDTH_FOR_ARIA}
        aria-valuemin={column.minWidth}
        aria-valuenow={width}
        className="project-task-resize"
        onKeyDown={resizeWithKeyboard}
        onLostPointerCapture={endDrag}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        role="separator"
        tabIndex={0}
      />
    </TableHead>
  );
};
