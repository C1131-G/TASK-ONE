/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */

"use client";

import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { useRef, useState } from "react";

import type { TimelineTask } from "@/features/projects/types/workspace-timeline-types";
import { useTaskDrawer } from "@/features/tasks/components/task-drawer";
import type { DragMode, TaskSpan } from "@/features/tasks/task-dates";
import { datesAfterDrag, dayDiff, sameSpan } from "@/features/tasks/task-dates";

// Pixels from either end of a bar that count as an edge drag.
const EDGE_PX = 8;

interface Drag {
  readonly days: number;
  readonly mode: DragMode;
  readonly pointerX: number;
}

// A bar is one button: a click opens the task drawer, a drag moves or resizes it
// by whole days, and the arrow keys do the same without a pointer.
export const TimelineBar = ({
  dayWidth,
  dayCount,
  editable,
  from,
  onMove,
  task,
}: {
  readonly dayCount: number;
  readonly dayWidth: number;
  readonly editable: boolean;
  readonly from: string;
  readonly onMove: (task: TimelineTask, dates: TaskSpan) => void;
  readonly task: TimelineTask;
}) => {
  const drawer = useTaskDrawer();
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const [preview, setPreview] = useState<{
    readonly days: number;
    readonly mode: DragMode;
  } | null>(null);
  const span: TaskSpan = { dueDate: task.dueDate, startDate: task.startDate };
  // The span the last key press asked for, and the span it started from. A
  // second press before the move has rendered builds on it, so a held arrow key
  // does not lose steps; once the task has moved, the shown span is used.
  const requested = useRef<{ from: TaskSpan; span: TaskSpan } | null>(null);
  const shown = preview
    ? datesAfterDrag(span, preview.mode, preview.days)
    : span;
  const shownStart = shown.startDate ?? shown.dueDate;
  const shownEnd = shown.dueDate ?? shown.startDate;
  if (!shownStart || !shownEnd) {
    return null;
  }
  const rawStart = dayDiff(from, shownStart);
  const rawEnd = dayDiff(from, shownEnd);
  if (rawEnd < 0 || rawStart >= dayCount) {
    return null;
  }
  const clippedStart = Math.max(0, rawStart);
  const clippedEnd = Math.min(dayCount - 1, rawEnd);
  const width = Math.max(dayWidth, (clippedEnd - clippedStart + 1) * dayWidth);
  const label = `${task.title}, ${shownStart} to ${shownEnd}`;

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!editable || event.button !== 0) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const offset = event.clientX - bounds.left;
    let mode: DragMode = "move";
    if (offset < EDGE_PX) {
      mode = "start";
    } else if (offset > bounds.width - EDGE_PX) {
      mode = "due";
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { days: 0, mode, pointerX: event.clientX };
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const { current } = drag;
    if (!current) {
      return;
    }
    const days = Math.round((event.clientX - current.pointerX) / dayWidth);
    if (days !== current.days) {
      drag.current = { ...current, days };
      setPreview({ days, mode: current.mode });
    }
  };

  const handlePointerUp = () => {
    const finished = drag.current;
    drag.current = null;
    setPreview(null);
    if (!finished || finished.days === 0) {
      return;
    }
    // The click that follows a drag must not also open the drawer.
    suppressClick.current = true;
    onMove(task, datesAfterDrag(span, finished.mode, finished.days));
  };

  // A cancelled pointer, such as the browser taking over to scroll, drops the drag.
  const handlePointerCancel = () => {
    drag.current = null;
    setPreview(null);
  };

  const handleClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    drawer?.openTask(task.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let step = 0;
    if (event.key === "ArrowRight") {
      step = 1;
    } else if (event.key === "ArrowLeft") {
      step = -1;
    }
    if (!editable || step === 0) {
      return;
    }
    event.preventDefault();
    let mode: DragMode = "move";
    if (event.altKey) {
      mode = "start";
    } else if (event.shiftKey) {
      mode = "due";
    }
    const base =
      requested.current && sameSpan(requested.current.from, span)
        ? requested.current.span
        : span;
    const next = datesAfterDrag(base, mode, step);
    requested.current = { from: span, span: next };
    onMove(task, next);
  };

  return (
    <button
      aria-label={`${label}. Arrow keys move. Shift with arrows changes the end date. Alt with arrows changes the start date.`}
      className={`bar${task.status === "done" ? " done" : ""}${editable ? " movable" : ""}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={
        {
          "--c": "var(--accent)",
          left: clippedStart * dayWidth,
          top: 6,
          width,
        } as CSSProperties
      }
      title={`${task.title} · ${shownStart} → ${shownEnd}`}
      type="button"
    >
      <span className="trunc">{task.title}</span>
    </button>
  );
};
