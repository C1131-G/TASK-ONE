/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */
/* eslint-disable shadcn/no-restyle */

/* eslint-disable jsx-a11y/label-has-associated-control */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { getPersonalWorkspaceAction } from "@/app/actions/discovery";
import { listEmployeesAction } from "@/app/actions/employees";
import { listProjectsAction } from "@/app/actions/projects";
import { listProjectTasksAction } from "@/app/actions/tasks";
import { FavoriteToggle } from "@/components/workspace/favorite-toggle";
import { TaskManageControls } from "@/components/workspace/task-manage-controls";
import { TaskStatusSelect } from "@/components/workspace/task-status-select";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "Tasks | Metsys" };

const todayString = (): string => new Date().toISOString().slice(0, 10);
const taskPriorityOrder = {
  high: 1,
  low: 3,
  medium: 2,
  none: 4,
  urgent: 0,
} as const;

const taskDescription = (
  status: string | null,
  overdue: boolean,
  count: number
): string => {
  if (status) {
    return `Tasks in ${status} status.`;
  }
  if (overdue) {
    return "Open tasks past their due date.";
  }
  return `Every task across ${count} projects.`;
};

const TasksPage = async ({ searchParams }: PageProps<"/tasks">) => {
  await connection();
  const [params, projects, session, employeeResult, personal] =
    await Promise.all([
      searchParams,
      listProjectsAction({}),
      getPageSession(),
      listEmployeesAction({ search: "" }),
      getPersonalWorkspaceAction({}),
    ]);
  if (!projects.ok) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Tasks could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }

  const taskLists = await Promise.all(
    projects.data.map(async (project) => ({
      project,
      result: await listProjectTasksAction({
        limit: 100,
        offset: 0,
        projectId: project.id,
      }),
    }))
  );
  const allTasks = taskLists.flatMap(({ project, result }) =>
    result.ok
      ? result.data.map((task) => ({
          ...task,
          projectKey: project.key,
          projectName: project.name,
        }))
      : []
  );
  const rawStatus = params.status;
  const selectedStatus =
    typeof rawStatus === "string" &&
    ["backlog", "todo", "progress", "review", "done"].includes(rawStatus)
      ? rawStatus
      : null;
  const selectedPriority =
    typeof params.priority === "string" &&
    ["urgent", "high", "medium", "low", "none"].includes(params.priority)
      ? params.priority
      : null;
  const query =
    typeof params.q === "string" ? params.q.trim().toLocaleLowerCase() : "";
  const sort =
    typeof params.sort === "string" &&
    ["due", "priority", "title"].includes(params.sort)
      ? params.sort
      : "due";
  const overdueOnly = params.overdue === "true";
  const today = overdueOnly ? todayString() : null;
  const tasks = allTasks.filter((task) => {
    if (selectedStatus && task.status !== selectedStatus) {
      return false;
    }
    if (selectedPriority && task.priority !== selectedPriority) {
      return false;
    }
    if (
      query &&
      !`${task.title} ${task.projectName} ${task.projectKey}`
        .toLocaleLowerCase()
        .includes(query)
    ) {
      return false;
    }
    if (
      overdueOnly &&
      (task.status === "done" || !task.dueDate || task.dueDate >= (today ?? ""))
    ) {
      return false;
    }
    return true;
  });
  tasks.sort((left, right) => {
    if (sort === "title") {
      return left.title.localeCompare(right.title);
    }
    if (sort === "priority") {
      return (
        taskPriorityOrder[left.priority] - taskPriorityOrder[right.priority]
      );
    }
    return (left.dueDate ?? "9999-12-31").localeCompare(
      right.dueDate ?? "9999-12-31"
    );
  });
  const userId = session.kind === "authenticated" ? session.user.id : null;
  const isAdmin =
    session.kind === "authenticated" && session.user.role === "admin";
  const favoriteTaskIds = new Set(
    personal.ok ? personal.data.tasks.map(({ id }) => id) : []
  );

  return (
    <div className="page flush">
      <div className="ph">
        <div>
          <h1>Tasks</h1>
          <p>
            {taskDescription(selectedStatus, overdueOnly, projects.data.length)}
          </p>
        </div>
      </div>
      <form className="toolbar task-filter" method="get">
        <label className="field">
          <span className="sr-only">Search tasks</span>
          <WorkspaceInput
            aria-label="Search tasks"
            className="input"
            defaultValue={query}
            name="q"
            placeholder="Search tasks"
          />
        </label>
        <label className="field">
          <span className="sr-only">Filter status</span>
          <select
            aria-label="Filter by status"
            className="input"
            defaultValue={selectedStatus ?? ""}
            name="status"
          >
            <option value="">All statuses</option>
            <option value="backlog">Backlog</option>
            <option value="todo">To Do</option>
            <option value="progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </label>
        <label className="field">
          <span className="sr-only">Filter priority</span>
          <select
            aria-label="Filter by priority"
            className="input"
            defaultValue={selectedPriority ?? ""}
            name="priority"
          >
            <option value="">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="none">No priority</option>
          </select>
        </label>
        <label className="field">
          <span className="sr-only">Sort tasks</span>
          <select
            aria-label="Sort tasks"
            className="input"
            defaultValue={sort}
            name="sort"
          >
            <option value="due">Sort: Due date</option>
            <option value="priority">Sort: Priority</option>
            <option value="title">Sort: Name</option>
          </select>
        </label>
        {overdueOnly ? (
          <input name="overdue" type="hidden" value="true" />
        ) : null}
        <WorkspaceButton className="btn btn-sm btn-secondary" type="submit">
          Apply filters
        </WorkspaceButton>
      </form>
      {tasks.length ? (
        <div className="list-wrap">
          <div className="tlist task-table-global">
            <div className="thead">
              <div>Task</div>
              <div>Project</div>
              <div>Status</div>
              <div>Priority</div>
              <div>Due date</div>
              <div>Actions</div>
            </div>
            {tasks.map((task) => (
              <div className="trow" key={task.id}>
                <div className="ttl">
                  <span className="mono faint">
                    {task.projectKey}-{task.projectTaskNumber}
                  </span>
                  <span className="trunc">{task.title}</span>
                </div>
                <div className="c-meta">
                  <Link href={`/projects/${task.projectId}` as Route}>
                    {task.projectName}
                  </Link>
                </div>
                <div className="c-meta">
                  {isAdmin ||
                  task.createdById === userId ||
                  task.assigneeIds.includes(userId ?? "") ? (
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
                <div className="c-meta row">
                  <FavoriteToggle
                    id={task.id}
                    initialFavorite={favoriteTaskIds.has(task.id)}
                    kind="task"
                  />
                  {isAdmin ||
                  task.createdById === userId ||
                  task.assigneeIds.includes(userId ?? "") ? (
                    <TaskManageControls
                      currentUserId={userId}
                      employees={employeeResult.ok ? employeeResult.data : []}
                      isAdmin={isAdmin}
                      task={task}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <section className="panel panel-b">
          <h2>
            {allTasks.length ? "No tasks match these filters" : "No tasks yet"}
          </h2>
          <p className="muted">
            {allTasks.length
              ? "Change the filter to see more tasks."
              : "Tasks will appear here when they are created in a project."}
          </p>
        </section>
      )}
    </div>
  );
};

export default TasksPage;
