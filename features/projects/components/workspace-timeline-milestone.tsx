/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */

"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { useRef, useState } from "react";

import type { MilestoneRecord } from "@/features/projects/milestone-dates";
import { milestoneDateAfterDrag } from "@/features/projects/milestone-dates";
import type { TimelineMilestoneLane } from "@/features/projects/types/workspace-timeline-types";
import { dayDiff } from "@/features/tasks/task-dates";

const MARKER_HALF = 6;

// A milestone diamond. An admin can drag it to another day, or press the arrow
// keys; everyone else sees a plain marker. The move keeps the milestone's name,
// completion and order.
export const TimelineMilestoneMarker = ({
  dayCount,
  dayWidth,
  from,
  lane,
  milestone,
  onMove,
}: {
  readonly dayCount: number;
  readonly dayWidth: number;
  readonly from: string;
  readonly lane: TimelineMilestoneLane;
  readonly milestone: MilestoneRecord;
  readonly onMove: (
    lane: TimelineMilestoneLane,
    milestone: MilestoneRecord,
    dueDate: string
  ) => void;
}) => {
  const drag = useRef<{ days: number; pointerX: number } | null>(null);
  const [previewDays, setPreviewDays] = useState(0);
  const { dueDate } = milestone;
  // The date the last key press asked for, and the date it started from. A
  // second press before the move has rendered builds on it, so a held arrow key
  // does not lose steps; once the milestone has moved, the shown date is used.
  const requested = useRef<{ from: string; date: string } | null>(null);
  if (!dueDate) {
    return null;
  }
  const shown = milestoneDateAfterDrag(dueDate, previewDays);
  const offset = dayDiff(from, shown);
  if (offset < 0 || offset >= dayCount) {
    return null;
  }
  const label = `${milestone.name}, due ${shown}${milestone.completed ? ", completed" : ""}`;
  const className = `tl-milestone${milestone.completed ? " done" : ""}`;
  const style = { left: offset * dayWidth + dayWidth / 2 - MARKER_HALF };

  if (!lane.editable) {
    return (
      <span className={className} style={style} title={`${label}`}>
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { days: 0, pointerX: event.clientX };
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const { current } = drag;
    if (!current) {
      return;
    }
    const days = Math.round((event.clientX - current.pointerX) / dayWidth);
    if (days !== current.days) {
      drag.current = { ...current, days };
      setPreviewDays(days);
    }
  };

  const handlePointerUp = () => {
    const finished = drag.current;
    drag.current = null;
    setPreviewDays(0);
    if (finished && finished.days !== 0) {
      onMove(lane, milestone, milestoneDateAfterDrag(dueDate, finished.days));
    }
  };

  // A cancelled pointer, such as the browser taking over to scroll, drops the drag.
  const handlePointerCancel = () => {
    drag.current = null;
    setPreviewDays(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let step = 0;
    if (event.key === "ArrowRight") {
      step = 1;
    } else if (event.key === "ArrowLeft") {
      step = -1;
    }
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const base =
      requested.current?.from === dueDate ? requested.current.date : dueDate;
    const next = milestoneDateAfterDrag(base, step);
    requested.current = { date: next, from: dueDate };
    onMove(lane, milestone, next);
  };

  return (
    <button
      aria-label={`${label}. Arrow keys move the milestone a day.`}
      className={`${className} movable`}
      onKeyDown={handleKeyDown}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={style}
      title={label}
      type="button"
    />
  );
};
