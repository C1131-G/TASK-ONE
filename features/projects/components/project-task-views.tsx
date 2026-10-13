/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { useState } from "react";

import { TaskCalendarGrid } from "@/features/calendar/components/task-calendar-grid";
import { ProjectTaskListViewContent } from "@/features/projects/components/project-task-list-view-content";
import { WorkspaceTimeline } from "@/features/projects/components/workspace-timeline";
import type { ProjectTaskViewItem } from "@/features/projects/types/project-task-view-types";
import { TaskCreateForm } from "@/features/tasks/components/task-create-form";
import type { CalendarEventSummary } from "@/src/server/calendar/calendar-contracts";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type {
  ProjectListItem,
  ProjectMilestone,
} from "@/src/server/projects/project-contracts";
import type { LabelSummary } from "@/src/server/tasks/label-management";

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});
const WEEK_LABEL_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export const ProjectTaskViews = ({
  view,
  project,
  tasks,
  editableTaskIds,
  currentUserId,
  isAdmin,
  employees,
  labels,
  monthOffset,
  calendarRange,
  calendarMode,
  calendarEvents,
  milestones,
  milestonesVersion,
  timelineRange,
}: {
  readonly view: string;
  readonly project: ProjectListItem;
  readonly tasks: readonly ProjectTaskViewItem[];
  readonly editableTaskIds: ReadonlySet<string>;
  readonly currentUserId: string | null;
  readonly isAdmin: boolean;
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly labels: readonly LabelSummary[];
  readonly monthOffset: number;
  readonly calendarRange: { readonly from: string; readonly to: string } | null;
  readonly calendarMode: "month" | "week";
  readonly calendarEvents: readonly CalendarEventSummary[] | null;
  readonly milestones: readonly ProjectMilestone[];
  readonly milestonesVersion: number;
  readonly timelineRange: { readonly from: string; readonly to: string } | null;
}) => {
  const [calendarTaskOpen, setCalendarTaskOpen] = useState(false);
  const [calendarTaskDueDate, setCalendarTaskDueDate] = useState("");

  const openTaskForDate = (dueDate: string) => {
    setCalendarTaskDueDate(dueDate);
    setCalendarTaskOpen(true);
  };
  const updateCalendarTaskOpen = (open: boolean) => {
    setCalendarTaskOpen(open);
    if (!open) {
      setCalendarTaskDueDate("");
    }
  };

  if (view === "calendar") {
    if (!calendarRange || !calendarEvents) {
      return (
        <section className="panel panel-b" role="alert">
          Project calendar could not be loaded.
        </section>
      );
    }
    const calendarLabel =
      calendarMode === "week"
        ? `${WEEK_LABEL_FORMATTER.format(new Date(`${calendarRange.from}T12:00:00Z`))} – ${WEEK_LABEL_FORMATTER.format(new Date(`${calendarRange.to}T12:00:00Z`))}`
        : MONTH_LABEL_FORMATTER.format(
            new Date(`${calendarRange.from}T12:00:00Z`)
          );
    return (
      <>
        <TaskCalendarGrid
          events={calendarEvents}
          employees={employees}
          hrefPrefix={`/projects/${project.id}?view=calendar&monthOffset=`}
          monthLabel={calendarLabel}
          monthOffset={monthOffset}
          onAddTask={openTaskForDate}
          projects={[project]}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          viewMode={calendarMode}
          tasks={tasks.map((task) => ({
            assigneeIds: task.assigneeIds,
            createdById: task.createdById,
            dependencyIds: task.dependencyIds,
            dueDate: task.dueDate,
            id: task.id,
            labelIds: task.labelIds,
            position: task.position,
            priority: task.priority,
            projectId: project.id,
            projectName: project.name,
            recurrence: task.recurrence,
            startDate: task.startDate,
            status: task.status,
            title: task.title,
            version: task.version,
          }))}
        />
        <TaskCreateForm
          defaultDueDate={calendarTaskDueDate}
          key={calendarTaskDueDate}
          onOpenChange={updateCalendarTaskOpen}
          open={calendarTaskOpen}
          projectId={project.id}
          trigger={null}
        />
      </>
    );
  }

  if (view === "timeline" && timelineRange) {
    return (
      <WorkspaceTimeline
        editableTaskIds={[...editableTaskIds]}
        employees={employees}
        from={timelineRange.from}
        milestoneLanes={[
          {
            allMilestones: milestones.map(
              ({ completed, dueDate, id, name }) => ({
                completed,
                dueDate,
                id,
                name,
              })
            ),
            editable: isAdmin,
            projectId: project.id,
            projectName: project.name,
            version: milestonesVersion,
          },
        ]}
        tasks={tasks.map((task) => ({
          assigneeIds: task.assigneeIds,
          dueDate: task.dueDate,
          id: task.id,
          position: task.position,
          priority: task.priority,
          projectId: project.id,
          projectName: project.name,
          startDate: task.startDate,
          status: task.status,
          title: task.title,
          version: task.version,
        }))}
        to={timelineRange.to}
      />
    );
  }

  if (view === "list" || view === "table") {
    return (
      <ProjectTaskListViewContent
        currentUserId={currentUserId}
        editableTaskIds={editableTaskIds}
        employees={employees}
        isAdmin={isAdmin}
        labels={labels}
        project={project}
        tasks={tasks}
        view={view}
      />
    );
  }

  return null;
};
