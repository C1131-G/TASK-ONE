/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle */

"use client";

import { useMemo } from "react";

import { GlobalTaskFilterBar } from "@/components/workspace/global-task-filter-bar";
import { GlobalTaskRows } from "@/components/workspace/global-task-rows";
import {
  GLOBAL_TASK_VIEWS,
  filterGlobalTasks,
  groupGlobalTasks,
  sortGlobalTasks,
} from "@/components/workspace/global-task-view-state";
import { QuickTaskForm } from "@/components/workspace/quick-task-form";
import { useGlobalTaskView } from "@/components/workspace/use-global-task-view";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { ProjectTaskListItem } from "@/src/server/work/work-contracts";

type GlobalTask = Omit<
  ProjectTaskListItem,
  "completionUndo" | "recurrenceSuccessorId"
> & {
  readonly projectKey: string;
  readonly projectName: string;
};

type TaskView = "list" | "board" | "table";

const toTaskView = (value: string): TaskView =>
  value === "board" || value === "table" ? value : "list";

const taskDescription = (
  status: string,
  overdue: boolean,
  projectCount: number
): string => {
  if (status !== "all") {
    return `Tasks in ${status} status.`;
  }
  if (overdue) {
    return "Open tasks past their due date.";
  }
  return `Every task across ${projectCount} projects.`;
};

export const GlobalTasksWorkspace = ({
  employees,
  favoriteTaskIds,
  isAdmin,
  projects,
  tasks,
  today,
  userId,
}: {
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly favoriteTaskIds: ReadonlySet<string>;
  readonly isAdmin: boolean;
  readonly projects: readonly { readonly id: string; readonly name: string }[];
  readonly tasks: readonly GlobalTask[];
  readonly today: string;
  readonly userId: string | null;
}) => {
  const { raw, search, update } = useGlobalTaskView(GLOBAL_TASK_VIEWS);
  const visibleTasks = useMemo(
    () => sortGlobalTasks(filterGlobalTasks(tasks, search, today), search.sort),
    [tasks, search, today]
  );
  const taskGroups = useMemo(
    () => groupGlobalTasks(visibleTasks, search.group),
    [visibleTasks, search.group]
  );
  const view = toTaskView(search.view);

  return (
    <div className="page flush">
      <div className="ph">
        <div>
          <h1>Tasks</h1>
          <p>
            {taskDescription(search.status, search.overdue, projects.length)}
          </p>
        </div>
        <QuickTaskForm projects={projects} />
      </div>
      <GlobalTaskFilterBar
        idPrefix="tasks"
        onChange={update}
        raw={raw}
        searchLabel="Search tasks"
        showGroup
      />
      <nav aria-label="Task view" className="row task-view-tabs">
        {GLOBAL_TASK_VIEWS.map((item) => (
          <WorkspaceButton
            aria-current={view === item ? "page" : undefined}
            key={item}
            onClick={() => update({ view: item })}
            size="sm"
            variant={view === item ? "default" : "secondary"}
          >
            {item[0]?.toLocaleUpperCase()}
            {item.slice(1)}
          </WorkspaceButton>
        ))}
      </nav>
      {visibleTasks.length ? (
        <GlobalTaskRows
          employees={employees}
          favoriteTaskIds={favoriteTaskIds}
          isAdmin={isAdmin}
          taskGroups={taskGroups}
          userId={userId}
          view={view}
        />
      ) : (
        <section className="panel panel-b">
          <h2>
            {tasks.length ? "No tasks match these filters" : "No tasks yet"}
          </h2>
          <p className="muted">
            {tasks.length
              ? "Change the filter to see more tasks."
              : "Tasks will appear here when they are created in a project."}
          </p>
        </section>
      )}
    </div>
  );
};
