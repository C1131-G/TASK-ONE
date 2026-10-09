/* eslint-disable shadcn/no-unknown-classes */

import type { Route } from "next";
import Link from "next/link";

import { TaskCalendarGrid } from "@/components/workspace/task-calendar-grid";
import { TaskManageControls } from "@/components/workspace/task-manage-controls";
import { TaskStatusSelect } from "@/components/workspace/task-status-select";
import { WorkspaceTimeline } from "@/components/workspace/workspace-timeline";
import type { CalendarEventSummary } from "@/src/server/calendar/calendar-contracts";
import type { ProjectListItem } from "@/src/server/projects/project-contracts";
import type { ProjectTaskListItem } from "@/src/server/work/work-contracts";

type ProjectTaskViewItem = Pick<
  ProjectTaskListItem,
  | "assigneeIds"
  | "createdById"
  | "dependencyIds"
  | "description"
  | "dueDate"
  | "estimate"
  | "id"
  | "labelIds"
  | "priority"
  | "projectId"
  | "projectTaskNumber"
  | "recurrence"
  | "startDate"
  | "status"
  | "title"
  | "version"
>;

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

export const ProjectTaskViews = ({
  view,
  project,
  tasks,
  editableTaskIds,
  currentUserId,
  isAdmin,
  employees,
  monthOffset,
  calendarRange,
  calendarEvents,
  timelineRange,
}: {
  readonly view: string;
  readonly project: ProjectListItem;
  readonly tasks: readonly ProjectTaskViewItem[];
  readonly editableTaskIds: ReadonlySet<string>;
  readonly currentUserId: string | null;
  readonly isAdmin: boolean;
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly monthOffset: number;
  readonly calendarRange: { readonly from: string } | null;
  readonly calendarEvents: readonly CalendarEventSummary[] | null;
  readonly timelineRange: { readonly from: string; readonly to: string } | null;
}) => {
  if (view === "calendar") {
    if (!calendarRange || !calendarEvents) {
      return (
        <section className="panel panel-b" role="alert">
          Project calendar could not be loaded.
        </section>
      );
    }
    return (
      <TaskCalendarGrid
        events={calendarEvents}
        hrefPrefix={`/projects/${project.id}?view=calendar&monthOffset=`}
        monthLabel={MONTH_LABEL_FORMATTER.format(
          new Date(`${calendarRange.from}T12:00:00Z`)
        )}
        monthOffset={monthOffset}
        tasks={tasks.map((task) => ({
          dueDate: task.dueDate,
          id: task.id,
          priority: task.priority,
          projectId: project.id,
          projectName: project.name,
          status: task.status,
          title: task.title,
        }))}
      />
    );
  }

  if (view === "timeline" && timelineRange) {
    return (
      <WorkspaceTimeline
        from={timelineRange.from}
        tasks={tasks.map((task) => ({
          dueDate: task.dueDate,
          id: task.id,
          projectId: project.id,
          projectName: project.name,
          startDate: task.startDate,
          status: task.status,
          title: task.title,
        }))}
        to={timelineRange.to}
      />
    );
  }

  if (view !== "list" && view !== "table") {
    return null;
  }

  return (
    <section className="panel">
      <div className="panel-h">
        <h2>{view === "list" ? "List" : "Table"}</h2>
        <Link
          className="btn btn-sm btn-primary"
          href={`/projects/${project.id}?view=board` as Route}
        >
          New task
        </Link>
      </div>
      <div className="list-wrap">
        <div className={`tlist project-task-${view}`}>
          <div className="thead">
            <div>Task</div>
            <div>Status</div>
            <div>Priority</div>
            <div>Due date</div>
            <div>Actions</div>
          </div>
          {tasks.map((task) => (
            <div className="trow" key={task.id}>
              <div className="ttl">
                <span className="mono faint">
                  {project.key}-{task.projectTaskNumber}
                </span>
                <span className="trunc">{task.title}</span>
              </div>
              <div className="c-meta">
                {editableTaskIds.has(task.id) ? (
                  <TaskStatusSelect
                    status={task.status}
                    taskId={task.id}
                    version={task.version}
                  />
                ) : (
                  <span className={`pstatus ${task.status}`}>
                    {task.status}
                  </span>
                )}
              </div>
              <div className="c-meta">{task.priority}</div>
              <div className="c-meta num">{task.dueDate ?? "—"}</div>
              <div className="c-meta">
                {editableTaskIds.has(task.id) ? (
                  <TaskManageControls
                    currentUserId={currentUserId}
                    employees={employees}
                    isAdmin={isAdmin}
                    task={task}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      {tasks.length ? null : (
        <div className="panel-b muted">No tasks in this project yet.</div>
      )}
    </section>
  );
};
