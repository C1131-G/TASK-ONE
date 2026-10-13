/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { Plus } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TaskCalendarGrid } from "@/features/calendar/components/task-calendar-grid";
import type {
  CalendarEvent,
  CalendarTask,
} from "@/features/calendar/components/task-calendar-grid";
import { QuickTaskForm } from "@/features/tasks/components/quick-task-form";

interface CalendarProjectOption {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

export const WorkspaceCalendar = ({
  monthOffset,
  monthLabel,
  tasks,
  events,
  projects,
  employees,
  currentUserId,
  isAdmin,
  viewMode,
}: {
  readonly monthOffset: number;
  readonly monthLabel: string;
  readonly tasks: readonly CalendarTask[];
  readonly events: readonly CalendarEvent[];
  readonly projects: readonly CalendarProjectOption[];
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly currentUserId: string | null;
  readonly isAdmin: boolean;
  readonly viewMode: "month" | "week";
}) => {
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [defaultDueDate, setDefaultDueDate] = useState("");

  const openTaskForDate = (dueDate: string) => {
    setDefaultDueDate(dueDate);
    setTaskFormOpen(true);
  };

  const updateTaskFormOpen = (open: boolean) => {
    setTaskFormOpen(open);
    if (!open) {
      setDefaultDueDate("");
    }
  };

  return (
    <>
      <div className="ph">
        <div>
          <h1>Calendar</h1>
          <p>Deadlines and events across every project.</p>
        </div>
        {projects.length ? (
          <QuickTaskForm
            defaultDueDate={defaultDueDate}
            key={defaultDueDate}
            onOpenChange={updateTaskFormOpen}
            open={taskFormOpen}
            projects={projects}
            trigger={
              <Button size="sm" type="button">
                <Plus aria-hidden="true" size={16} /> New task
              </Button>
            }
          />
        ) : null}
      </div>
      <TaskCalendarGrid
        events={events}
        employees={employees}
        monthLabel={monthLabel}
        monthOffset={monthOffset}
        onAddTask={openTaskForDate}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        projects={projects}
        tasks={tasks}
        viewMode={viewMode}
      />
    </>
  );
};
