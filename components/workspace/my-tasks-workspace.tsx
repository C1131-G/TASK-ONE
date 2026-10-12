/* eslint-disable shadcn/no-unknown-classes */

"use client";

import type { Route } from "next";
import Link from "next/link";
import { useMemo } from "react";

import { FavoriteToggle } from "@/components/workspace/favorite-toggle";
import { GlobalTaskFilterBar } from "@/components/workspace/global-task-filter-bar";
import type { DueGroup } from "@/components/workspace/global-task-view-state";
import {
  MY_TASK_VIEWS,
  filterGlobalTasks,
  globalTaskHref,
  groupTasksByDueDate,
  sortGlobalTasks,
} from "@/components/workspace/global-task-view-state";
import { MyTasksCalendar } from "@/components/workspace/my-tasks-calendar";
import { QuickTaskForm } from "@/components/workspace/quick-task-form";
import type { CalendarTask } from "@/components/workspace/task-calendar-grid";
import { TaskManageControls } from "@/components/workspace/task-manage-controls";
import { TaskStatusSelect } from "@/components/workspace/task-status-select";
import { useGlobalTaskView } from "@/components/workspace/use-global-task-view";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { ProjectTaskListItem } from "@/src/server/work/work-contracts";

export interface AssignedTask extends Omit<
  ProjectTaskListItem,
  "completionUndo" | "recurrenceSuccessorId"
> {
  readonly projectId: string;
  readonly projectKey: string;
  readonly projectName: string;
}

interface CalendarProject {
  readonly color: string;
  readonly id: string;
  readonly name: string;
}

interface MyTasksWorkspaceProps {
  readonly calendarMode: "month" | "week";
  readonly calendarProjects: readonly CalendarProject[];
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly favoriteTaskIds: ReadonlySet<string>;
  readonly isAdmin: boolean;
  readonly monthLabel: string;
  readonly monthOffset: number;
  readonly tasks: readonly AssignedTask[];
  readonly today: string;
  readonly userId: string;
}

const DUE_SUMMARY_DESCRIPTIONS: Readonly<Record<string, string>> = {
  overdue: "overdue",
  today: "due today",
  upcoming: "upcoming",
};

const TaskRows = ({
  groups,
  favoriteTaskIds,
  employees,
  userId,
  isAdmin,
}: {
  readonly groups: readonly DueGroup<AssignedTask>[];
  readonly favoriteTaskIds: ReadonlySet<string>;
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly userId: string;
  readonly isAdmin: boolean;
}) => (
  <div className="list-wrap">
    <div className="tlist task-table-global my-task-table">
      <div className="thead">
        <div>Task</div>
        <div>Project</div>
        <div>Status</div>
        <div>Priority</div>
        <div>Due date</div>
        <div>Actions</div>
      </div>
      {groups.map((group) => (
        <section className="my-task-group" key={group.id}>
          <h2 className="task-group-heading">
            {group.label} <span>{group.tasks.length}</span>
          </h2>
          {group.tasks.map((task) => (
            <div className="trow" key={task.id}>
              <div className="ttl">
                <span className="mono faint">
                  {task.projectKey}-{task.projectTaskNumber}
                </span>
                <Link
                  className="trunc"
                  href={`/projects/${task.projectId}?view=board`}
                >
                  {task.title}
                </Link>
              </div>
              <div className="c-meta">
                <Link href={`/projects/${task.projectId}`}>
                  {task.projectName}
                </Link>
              </div>
              <div className="c-meta">
                <TaskStatusSelect
                  status={task.status}
                  taskId={task.id}
                  version={task.version}
                />
              </div>
              <div className="c-meta">{task.priority}</div>
              <div className="c-meta num">{task.dueDate ?? "—"}</div>
              <div className="c-meta row">
                <FavoriteToggle
                  id={task.id}
                  initialFavorite={favoriteTaskIds.has(task.id)}
                  kind="task"
                />
                <TaskManageControls
                  canEdit
                  currentUserId={userId}
                  employees={employees}
                  isAdmin={isAdmin}
                  task={task}
                />
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  </div>
);

// Tabs are links so the server recomputes the calendar range, and each link keeps
// every filter the user has set.
export const MyTasksWorkspace = ({
  calendarMode,
  calendarProjects,
  employees,
  favoriteTaskIds,
  isAdmin,
  monthLabel,
  monthOffset,
  tasks,
  today,
  userId,
}: MyTasksWorkspaceProps) => {
  const { raw, search, update } = useGlobalTaskView(MY_TASK_VIEWS);
  const visibleTasks = useMemo(
    () => sortGlobalTasks(filterGlobalTasks(tasks, search, today), search.sort),
    [tasks, search, today]
  );
  const groups = useMemo(
    () => groupTasksByDueDate(visibleTasks, today),
    [visibleTasks, today]
  );
  const dueSummary = groups
    .flatMap((group) => {
      const description = DUE_SUMMARY_DESCRIPTIONS[group.id];
      return description ? [`${group.tasks.length} ${description}`] : [];
    })
    .join(" · ");
  const calendarTasks: CalendarTask[] = useMemo(
    () =>
      visibleTasks.map((task) => ({
        assigneeIds: task.assigneeIds,
        createdById: task.createdById,
        dependencyIds: task.dependencyIds,
        dueDate: task.dueDate,
        id: task.id,
        labelIds: task.labelIds,
        position: task.position,
        priority: task.priority,
        projectId: task.projectId,
        projectName: task.projectName,
        recurrence: task.recurrence,
        status: task.status,
        title: task.title,
        version: task.version,
      })),
    [visibleTasks]
  );
  const view = search.view === "calendar" ? "calendar" : "list";
  const calendarHrefPrefix = `${globalTaskHref("/my-tasks", raw, {
    monthOffset: "",
    view: "calendar",
  })}&monthOffset=`;

  return (
    <div className="page flush">
      <div className="ph my-tasks-header">
        <div>
          <h1>My Tasks</h1>
          <p>{dueSummary || `${visibleTasks.length} assigned tasks`}</p>
        </div>
        {calendarProjects.length > 0 ? (
          <QuickTaskForm
            projects={calendarProjects.map(({ id, name }) => ({ id, name }))}
          />
        ) : null}
        <nav aria-label="My Tasks view" className="row">
          <WorkspaceButton
            asChild
            size="sm"
            variant={view === "list" ? "default" : "secondary"}
          >
            <Link
              aria-current={view === "list" ? "page" : undefined}
              href={globalTaskHref("/my-tasks", raw, { view: "list" }) as Route}
            >
              List
            </Link>
          </WorkspaceButton>
          <WorkspaceButton
            asChild
            size="sm"
            variant={view === "calendar" ? "default" : "secondary"}
          >
            <Link
              aria-current={view === "calendar" ? "page" : undefined}
              href={
                globalTaskHref("/my-tasks", raw, { view: "calendar" }) as Route
              }
            >
              Calendar
            </Link>
          </WorkspaceButton>
        </nav>
      </div>
      <GlobalTaskFilterBar
        idPrefix="my-tasks"
        onChange={update}
        raw={raw}
        searchLabel="Search my tasks"
        showGroup={false}
      />
      {view === "calendar" ? (
        <MyTasksCalendar
          currentUserId={userId}
          employees={employees}
          hrefPrefix={calendarHrefPrefix}
          isAdmin={isAdmin}
          monthLabel={monthLabel}
          monthOffset={monthOffset}
          projects={calendarProjects}
          tasks={calendarTasks}
          viewMode={calendarMode}
        />
      ) : null}
      {view === "list" && visibleTasks.length > 0 ? (
        <TaskRows
          employees={employees}
          favoriteTaskIds={favoriteTaskIds}
          groups={groups}
          isAdmin={isAdmin}
          userId={userId}
        />
      ) : null}
      {view === "list" && visibleTasks.length === 0 ? (
        <section className="panel panel-b">
          <h2>
            {tasks.length
              ? "No tasks match these filters"
              : "No tasks assigned to you"}
          </h2>
          <p className="muted">
            {tasks.length
              ? "Change the filters to see more of your tasks."
              : "Tasks assigned to your account will appear here."}
          </p>
        </section>
      ) : null}
    </div>
  );
};
