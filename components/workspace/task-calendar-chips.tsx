/* eslint-disable shadcn/no-inline-styles, shadcn/no-restyle, shadcn/no-unknown-classes */

"use client";

import { useOptimistic } from "react";

import { TaskDetailsPanel } from "@/components/workspace/task-details-panel";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";
import type { CalendarEventSummary } from "@/src/server/calendar/calendar-contracts";
import type { TaskRecurrenceInput } from "@/src/server/work/work-contracts";

export interface CalendarTask {
  readonly assigneeIds: readonly string[];
  readonly createdById: string;
  readonly dependencyIds: readonly string[];
  readonly id: string;
  readonly labelIds: readonly string[];
  readonly title: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly dueDate: string | null;
  readonly recurrence: TaskRecurrenceInput | null;
  readonly status: string;
  readonly priority: string;
  readonly position: number;
  readonly version: number;
}

export type CalendarEvent = CalendarEventSummary;

export const CalendarTaskChip = ({
  currentUserId,
  employees,
  isAdmin,
  projectColor,
  task,
}: {
  readonly currentUserId: string | null;
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly isAdmin: boolean;
  readonly projectColor: string;
  readonly task: CalendarTask;
}) => {
  const [version, setVersion] = useOptimistic(task.version);
  const editable =
    isAdmin ||
    task.createdById === currentUserId ||
    task.assigneeIds.includes(currentUserId ?? "");

  return (
    <TaskDetailsPanel
      currentUserId={currentUserId}
      dependencyIds={task.dependencyIds}
      dueDate={task.dueDate}
      editable={editable}
      employees={employees}
      isAdmin={isAdmin}
      labelIds={task.labelIds}
      onVersionChange={setVersion}
      projectId={task.projectId}
      recurrence={task.recurrence}
      taskId={task.id}
      taskTitle={task.title}
      trigger={
        <WorkspaceButton
          aria-label={`Open details for ${task.title}`}
          className="cev"
          data-done={task.status === "done"}
          style={{ "--c": projectColor } as React.CSSProperties}
          title={`${task.title} · ${task.projectName}`}
          type="button"
        >
          <span aria-hidden="true" className="pdot" />
          <span className="trunc">{task.title}</span>
        </WorkspaceButton>
      }
      version={version}
    />
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
        style={{ "--c": projectColor } as React.CSSProperties}
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
