/* eslint-disable shadcn/no-inline-styles, shadcn/no-restyle, shadcn/no-unknown-classes */

"use client";

import { useId, useOptimistic, useState } from "react";
import type { DragEvent } from "react";

import { useTouchChipDrag } from "@/components/workspace/use-touch-chip-drag";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceDatePicker } from "@/components/workspace/workspace-date-picker";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";
import { TaskDetailsPanel } from "@/features/tasks/components/task-details-panel";
import { canEditTaskRecord } from "@/features/tasks/task-permissions";
import type { CalendarEventSummary } from "@/src/server/calendar/calendar-contracts";
import type { TaskRecurrenceInput } from "@/src/server/work/work-contracts";

export interface CalendarTask {
  readonly assigneeIds: readonly string[];
  readonly createdById: string;
  readonly dependencyIds: readonly string[];
  readonly dueDate: string | null;
  readonly id: string;
  readonly labelIds: readonly string[];
  readonly position: number;
  readonly priority: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly recurrence: TaskRecurrenceInput | null;
  readonly startDate: string | null;
  readonly status: string;
  readonly title: string;
  readonly version: number;
}

export type CalendarEvent = CalendarEventSummary;

// Drag data type for a task chip. The day cell reads it on drop.
export const TASK_DRAG_TYPE = "application/x-metsys-task";

const MoveTaskForm = ({
  dueDate,
  onMove,
  title,
}: {
  readonly dueDate: string | null;
  readonly onMove: (day: string) => void;
  readonly title: string;
}) => {
  const fieldId = useId();
  const [day, setDay] = useState(dueDate ?? "");
  return (
    <form
      className="panel-b stack"
      onSubmit={(event) => {
        event.preventDefault();
        if (day) {
          onMove(day);
        }
      }}
    >
      <label className="field" htmlFor={fieldId}>
        <span>New due date for {title}</span>
      </label>
      <WorkspaceDatePicker
        className="input"
        id={fieldId}
        onValueChange={(value) => setDay(value ?? "")}
        value={day}
      />
      <WorkspaceButton
        className="btn btn-sm btn-secondary"
        disabled={!day || day === dueDate}
        type="submit"
      >
        Move task
      </WorkspaceButton>
    </form>
  );
};

export const CalendarTaskChip = ({
  currentUserId,
  employees,
  isAdmin,
  onMove,
  projectColor,
  task,
}: {
  readonly currentUserId: string | null;
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly isAdmin: boolean;
  // Undefined where the chip cannot be moved; the chip then stays static.
  readonly onMove: ((taskId: string, day: string) => void) | undefined;
  readonly projectColor: string;
  readonly task: CalendarTask;
}) => {
  const [version, setVersion] = useOptimistic(task.version);
  const editable = canEditTaskRecord(task, currentUserId, isAdmin);
  const movable = editable && onMove !== undefined;

  const startDrag = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData(TASK_DRAG_TYPE, task.id);
    event.dataTransfer.effectAllowed = "move";
  };

  // A finger holds the chip, then drags it onto a day. The drop is the same move
  // the mouse drop and the Move control make.
  const touch = useTouchChipDrag({
    enabled: movable,
    onDrop: (day) => onMove?.(task.id, day),
  });

  return (
    <div
      className="cal-chip"
      data-touch-dragging={touch.dragging || undefined}
      draggable={movable}
      onDragStart={
        movable
          ? (event) => {
              if (touch.dragging) {
                event.preventDefault();
                return;
              }
              startDrag(event);
            }
          : undefined
      }
      {...(movable ? touch.handlers : {})}
    >
      <TaskDetailsPanel
        currentUserId={currentUserId}
        editable={editable}
        employees={employees}
        isAdmin={isAdmin}
        onVersionChange={setVersion}
        projectId={task.projectId}
        taskId={task.id}
        taskTitle={task.title}
        trigger={
          <WorkspaceButton
            aria-label={`Open details for ${task.title}`}
            className="cev"
            data-done={task.status === "done"}
            style={{ "--c": projectColor }}
            title={`${task.title} · ${task.projectName}`}
            type="button"
          >
            <span aria-hidden="true" className="pdot" />
            <span className="trunc">{task.title}</span>
          </WorkspaceButton>
        }
        version={version}
      />
      {movable ? (
        <WorkspaceDisclosure
          description={`Choose a new due date for ${task.title}. Its start date moves by the same number of days.`}
          title={`Move ${task.title}`}
          trigger={
            <WorkspaceButton
              aria-label={`Move ${task.title} to another day`}
              className="ibtn ibtn-sm cal-chip-move"
              title={`Move ${task.title}`}
              type="button"
            >
              Move
            </WorkspaceButton>
          }
        >
          <MoveTaskForm
            dueDate={task.dueDate}
            onMove={(day) => onMove(task.id, day)}
            title={task.title}
          />
        </WorkspaceDisclosure>
      ) : null}
    </div>
  );
};

export const CalendarEventChip = ({
  event,
  projectColor,
  projectName,
}: {
  readonly event: CalendarEvent;
  readonly projectColor: string;
  readonly projectName: string | null;
}) => (
  <WorkspaceDisclosure
    description="Review this workspace calendar event."
    title={event.title}
    trigger={
      <WorkspaceButton
        className="cev event"
        style={{ "--c": projectColor }}
        title={event.title}
        type="button"
      >
        <span className="trunc">{event.title}</span>
      </WorkspaceButton>
    }
  >
    <div className="panel-b stack calendar-event-details">
      <p>
        <time dateTime={event.startsAt.toISOString()}>
          {event.startsAt.toLocaleString()}
        </time>
        {event.endsAt ? (
          <>
            {" – "}
            <time dateTime={event.endsAt.toISOString()}>
              {event.endsAt.toLocaleString()}
            </time>
          </>
        ) : null}
      </p>
      {projectName ? <p className="muted">{projectName}</p> : null}
      {event.location ? <p>{event.location}</p> : null}
      {event.description ? <p>{event.description}</p> : null}
    </div>
  </WorkspaceDisclosure>
);
