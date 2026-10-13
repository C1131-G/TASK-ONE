/* eslint-disable shadcn/no-inline-styles, shadcn/no-restyle, shadcn/no-unknown-classes */

"use client";

import { Plus } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";
import {
  CalendarEventChip,
  CalendarTaskChip,
  TASK_DRAG_TYPE,
} from "@/features/calendar/components/task-calendar-chips";
import type {
  CalendarEvent,
  CalendarTask,
} from "@/features/calendar/components/task-calendar-chips";

interface CalendarProject {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);
const dayLabelFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export const TaskCalendarDays = ({
  days,
  currentMonth,
  today,
  taskByDay,
  eventByDay,
  projectById,
  employees,
  currentUserId,
  isAdmin,
  onAddTask,
  onMoveTask,
}: {
  readonly days: readonly Date[];
  readonly currentMonth: Date;
  readonly today: string;
  readonly taskByDay: ReadonlyMap<string, readonly CalendarTask[]>;
  readonly eventByDay: ReadonlyMap<string, readonly CalendarEvent[]>;
  readonly projectById: ReadonlyMap<string, CalendarProject>;
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly currentUserId: string | null;
  readonly isAdmin: boolean;
  readonly onAddTask: ((dueDate: string) => void) | undefined;
  // Drop target for dragged chips; keyboard moves use the chip Move control.
  readonly onMoveTask?: (taskId: string, day: string) => void;
}) => {
  // The day a dragged chip is over, so the target reads before the drop.
  const [overKey, setOverKey] = useState<string | null>(null);
  return (
    <div className="cal-g workspace-calendar-grid">
      {days.map((date) => {
        const key = dayKey(date);
        const dayTasks = taskByDay.get(key) ?? [];
        const dayEvents = eventByDay.get(key) ?? [];
        const visibleEvents = dayEvents.slice(0, 2);
        const visibleTaskCount = 3 - visibleEvents.length;
        const hiddenEvents = dayEvents.slice(visibleEvents.length);
        const hiddenTasks = dayTasks.slice(visibleTaskCount);
        const isCurrentMonth =
          date.getUTCMonth() === currentMonth.getUTCMonth();

        return (
          <div
            className={`cday${isCurrentMonth ? "" : " out"}${key === today ? " today" : ""}${overKey === key ? " over" : ""}`}
            data-day={key}
            key={key}
            onDragEnter={onMoveTask ? () => setOverKey(key) : undefined}
            onDragLeave={onMoveTask ? () => setOverKey(null) : undefined}
            onDragOver={
              onMoveTask
                ? (event) => {
                    // Only task drags reach a day cell here; the drop reads the ID.
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }
                : undefined
            }
            onDrop={
              onMoveTask
                ? (event) => {
                    const taskId = event.dataTransfer.getData(TASK_DRAG_TYPE);
                    setOverKey(null);
                    if (taskId) {
                      event.preventDefault();
                      onMoveTask(taskId, key);
                    }
                  }
                : undefined
            }
          >
            <span
              aria-current={key === today ? "date" : undefined}
              className="dn"
            >
              {date.getUTCDate()}
            </span>
            {onAddTask ? (
              <div className="add calendar-add-task">
                <Button
                  aria-label={`Add task on ${dayLabelFormatter.format(date)}`}
                  onClick={() => onAddTask(key)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <Plus aria-hidden="true" size={16} />
                </Button>
              </div>
            ) : null}
            {visibleEvents.map((event) => {
              const eventProject = event.projectId
                ? projectById.get(event.projectId)
                : undefined;
              return (
                <CalendarEventChip
                  event={event}
                  key={event.id}
                  projectColor={eventProject?.color ?? "var(--muted)"}
                  projectName={eventProject?.name ?? null}
                />
              );
            })}
            {dayTasks.slice(0, visibleTaskCount).map((task) => (
              <CalendarTaskChip
                currentUserId={currentUserId}
                employees={employees}
                isAdmin={isAdmin}
                key={task.id}
                onMove={onMoveTask}
                projectColor={
                  projectById.get(task.projectId)?.color ?? "var(--muted)"
                }
                task={task}
              />
            ))}
            {hiddenTasks.length + hiddenEvents.length > 0 ? (
              <WorkspaceDisclosure
                description={`All calendar items for ${dayLabelFormatter.format(date)}.`}
                title={dayLabelFormatter.format(date)}
                trigger={
                  <WorkspaceButton
                    className="cmore"
                    type="button"
                    variant="ghost"
                  >
                    +{hiddenTasks.length + hiddenEvents.length} more
                  </WorkspaceButton>
                }
              >
                <div className="stack calendar-overflow-items">
                  {hiddenEvents.map((event) => {
                    const eventProject = event.projectId
                      ? projectById.get(event.projectId)
                      : undefined;
                    return (
                      <CalendarEventChip
                        event={event}
                        key={event.id}
                        projectColor={eventProject?.color ?? "var(--muted)"}
                        projectName={eventProject?.name ?? null}
                      />
                    );
                  })}
                  {hiddenTasks.map((task) => (
                    <CalendarTaskChip
                      currentUserId={currentUserId}
                      employees={employees}
                      isAdmin={isAdmin}
                      key={task.id}
                      onMove={onMoveTask}
                      projectColor={
                        projectById.get(task.projectId)?.color ?? "var(--muted)"
                      }
                      task={task}
                    />
                  ))}
                </div>
              </WorkspaceDisclosure>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
