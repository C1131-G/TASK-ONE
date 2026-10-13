/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { useState } from "react";

import { TaskCalendarGrid } from "@/features/calendar/components/task-calendar-grid";
import type { CalendarTask } from "@/features/calendar/components/task-calendar-grid";
import { QuickTaskForm } from "@/features/tasks/components/quick-task-form";

interface ProjectOption {
  readonly color: string;
  readonly id: string;
  readonly name: string;
}

export const MyTasksCalendar = ({
  hrefPrefix,
  monthOffset,
  monthLabel,
  tasks,
  projects,
  employees,
  currentUserId,
  isAdmin,
  viewMode,
}: {
  // Month links carry the active filters, so the prefix is built by the caller.
  readonly hrefPrefix: string;
  readonly monthOffset: number;
  readonly monthLabel: string;
  readonly tasks: readonly CalendarTask[];
  readonly projects: readonly ProjectOption[];
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly currentUserId: string | null;
  readonly isAdmin: boolean;
  readonly viewMode: "month" | "week";
}) => {
  const [open, setOpen] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const openTaskForDate = (nextDueDate: string) => {
    setDueDate(nextDueDate);
    setOpen(true);
  };
  const updateOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setDueDate("");
    }
  };

  return (
    <>
      {projects.length > 0 ? (
        <QuickTaskForm
          defaultDueDate={dueDate}
          key={dueDate}
          onOpenChange={updateOpen}
          open={open}
          projects={projects}
          trigger={null}
        />
      ) : null}
      <TaskCalendarGrid
        events={[]}
        employees={employees}
        hrefPrefix={hrefPrefix}
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
