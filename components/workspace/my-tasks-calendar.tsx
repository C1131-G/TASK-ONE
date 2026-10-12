/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { useState } from "react";

import { QuickTaskForm } from "@/components/workspace/quick-task-form";
import { TaskCalendarGrid } from "@/components/workspace/task-calendar-grid";
import type { CalendarTask } from "@/components/workspace/task-calendar-grid";

interface ProjectOption {
  readonly color: string;
  readonly id: string;
  readonly name: string;
}

export const MyTasksCalendar = ({
  monthOffset,
  monthLabel,
  tasks,
  projects,
  employees,
  currentUserId,
  isAdmin,
  viewMode,
}: {
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
        hrefPrefix="/my-tasks?view=calendar&monthOffset="
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
