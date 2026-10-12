/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */
/* eslint-disable shadcn/no-restyle */

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { getPersonalWorkspaceAction } from "@/app/actions/discovery";
import { listEmployeesAction } from "@/app/actions/employees";
import { listProjectsAction } from "@/app/actions/projects";
import { listProjectTasksAction } from "@/app/actions/tasks";
import { GlobalTaskRows } from "@/components/workspace/global-task-rows";
import { QuickTaskForm } from "@/components/workspace/quick-task-form";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import { getPageSession } from "@/src/server/auth/page-session";
import type { ProjectTaskListItem } from "@/src/server/work/work-contracts";

export const metadata: Metadata = { title: "Tasks | Metsys" };

const todayString = (): string => new Date().toISOString().slice(0, 10);
const taskPriorityOrder = {
  high: 1,
  low: 3,
  medium: 2,
  none: 4,
  urgent: 0,
} as const;
const taskStatusLabels: Readonly<Record<string, string>> = {
  backlog: "Backlog",
  done: "Done",
  progress: "In Progress",
  review: "Review",
  todo: "To Do",
} as const;
type GlobalTask = Omit<
  ProjectTaskListItem,
  "completionUndo" | "recurrenceSuccessorId"
> & {
  readonly projectKey: string;
  readonly projectName: string;
};
interface TaskGroup {
  readonly key: string;
  readonly label: string;
  readonly tasks: readonly GlobalTask[];
}

type TaskSearchParams = Readonly<Record<string, string | string[] | undefined>>;

interface TaskView {
  readonly groupBy: "status" | "project" | "assignee" | "priority" | "none";
  readonly overdueOnly: boolean;
  readonly query: string;
  readonly selectedPriority: string | null;
  readonly selectedStatus: string | null;
  readonly sort: "due" | "priority" | "title";
  readonly tasks: readonly GlobalTask[];
  readonly taskGroups: readonly TaskGroup[];
  readonly view: "list" | "board" | "table";
}

const groupTasks = (
  tasks: readonly GlobalTask[],
  groupBy: "status" | "project" | "assignee" | "priority" | "none"
): readonly TaskGroup[] => {
  if (groupBy === "none") {
    return [{ key: "all", label: "All tasks", tasks }];
  }

  const grouped = new Map<string, GlobalTask[]>();
  for (const task of tasks) {
    let value: string;
    switch (groupBy) {
      case "status": {
        value = task.status;
        break;
      }
      case "project": {
        value = task.projectName;
        break;
      }
      case "assignee": {
        value = task.assignees[0]?.name ?? "Unassigned";
        break;
      }
      case "priority": {
        value = task.priority;
        break;
      }
      default: {
        value = "All tasks";
      }
    }
    const values = grouped.get(value) ?? [];
    values.push(task);
    grouped.set(value, values);
  }

  const keys = [...grouped.keys()].toSorted((left, right) => {
    if (groupBy === "status") {
      const statusOrder = ["backlog", "todo", "progress", "review", "done"];
      return statusOrder.indexOf(left) - statusOrder.indexOf(right);
    }
    return left.localeCompare(right);
  });
  return keys.map((key) => ({
    key,
    label: groupBy === "status" ? (taskStatusLabels[key] ?? key) : key,
    tasks: grouped.get(key) ?? [],
  }));
};

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

const buildTaskView = (
  allTasks: readonly GlobalTask[],
  params: TaskSearchParams
): TaskView => {
  const validStatuses = ["backlog", "todo", "progress", "review", "done"];
  const validPriorities = ["urgent", "high", "medium", "low", "none"];
  const rawStatus = params.status;
  const selectedStatus =
    typeof rawStatus === "string" && validStatuses.includes(rawStatus)
      ? rawStatus
      : null;
  const selectedPriority =
    typeof params.priority === "string" &&
    validPriorities.includes(params.priority)
      ? params.priority
      : null;
  const query =
    typeof params.q === "string" ? params.q.trim().toLocaleLowerCase() : "";
  const sort: TaskView["sort"] =
    typeof params.sort === "string" &&
    ["due", "priority", "title"].includes(params.sort)
      ? (params.sort as TaskView["sort"])
      : "due";
  const overdueOnly = params.overdue === "true";
  const groupBy =
    typeof params.group === "string" &&
    ["status", "project", "assignee", "priority", "none"].includes(params.group)
      ? (params.group as TaskView["groupBy"])
      : "status";
  const view =
    typeof params.view === "string" &&
    ["list", "board", "table"].includes(params.view)
      ? (params.view as TaskView["view"])
      : "list";
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

  return {
    groupBy,
    overdueOnly,
    query,
    selectedPriority,
    selectedStatus,
    sort,
    taskGroups: groupTasks(tasks, groupBy),
    tasks,
    view,
  };
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
  const taskView = buildTaskView(allTasks, params);
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
            {taskDescription(
              taskView.selectedStatus,
              taskView.overdueOnly,
              projects.data.length
            )}
          </p>
        </div>
        <QuickTaskForm
          projects={projects.data.map(({ id, name }) => ({ id, name }))}
        />
      </div>
      <form className="toolbar task-filter" method="get">
        <input name="view" type="hidden" value={taskView.view} />
        <label className="field" htmlFor="metsys-page-field-161">
          <span className="sr-only">Search tasks</span>
          <WorkspaceInput
            aria-label="Search tasks"
            className="input"
            defaultValue={taskView.query}
            name="q"
            placeholder="Search tasks"
            id="metsys-page-field-161"
          />
        </label>
        <label className="field" htmlFor="metsys-page-field-171">
          <span className="sr-only">Filter status</span>
          <WorkspaceSelect
            aria-label="Filter by status"
            className="input"
            defaultValue={taskView.selectedStatus ?? ""}
            name="status"
            id="metsys-page-field-171"
          >
            <WorkspaceSelectItem value="">All statuses</WorkspaceSelectItem>
            <WorkspaceSelectItem value="backlog">Backlog</WorkspaceSelectItem>
            <WorkspaceSelectItem value="todo">To Do</WorkspaceSelectItem>
            <WorkspaceSelectItem value="progress">
              In Progress
            </WorkspaceSelectItem>
            <WorkspaceSelectItem value="review">Review</WorkspaceSelectItem>
            <WorkspaceSelectItem value="done">Done</WorkspaceSelectItem>
          </WorkspaceSelect>
        </label>
        <label className="field" htmlFor="metsys-page-field-189">
          <span className="sr-only">Filter priority</span>
          <WorkspaceSelect
            aria-label="Filter by priority"
            className="input"
            defaultValue={taskView.selectedPriority ?? ""}
            name="priority"
            id="metsys-page-field-189"
          >
            <WorkspaceSelectItem value="">All priorities</WorkspaceSelectItem>
            <WorkspaceSelectItem value="urgent">Urgent</WorkspaceSelectItem>
            <WorkspaceSelectItem value="high">High</WorkspaceSelectItem>
            <WorkspaceSelectItem value="medium">Medium</WorkspaceSelectItem>
            <WorkspaceSelectItem value="low">Low</WorkspaceSelectItem>
            <WorkspaceSelectItem value="none">No priority</WorkspaceSelectItem>
          </WorkspaceSelect>
        </label>
        <label className="field" htmlFor="metsys-page-field-205">
          <span className="sr-only">Sort tasks</span>
          <WorkspaceSelect
            aria-label="Sort tasks"
            className="input"
            defaultValue={taskView.sort}
            name="sort"
            id="metsys-page-field-205"
          >
            <WorkspaceSelectItem value="due">
              Sort: Due date
            </WorkspaceSelectItem>
            <WorkspaceSelectItem value="priority">
              Sort: Priority
            </WorkspaceSelectItem>
            <WorkspaceSelectItem value="title">Sort: Name</WorkspaceSelectItem>
          </WorkspaceSelect>
        </label>
        <label className="field" htmlFor="metsys-page-field-220">
          <span className="sr-only">Group tasks</span>
          <WorkspaceSelect
            aria-label="Group tasks"
            className="input"
            defaultValue={taskView.groupBy}
            name="group"
            id="metsys-page-field-220"
          >
            <WorkspaceSelectItem value="status">
              Group: Status
            </WorkspaceSelectItem>
            <WorkspaceSelectItem value="project">
              Group: Project
            </WorkspaceSelectItem>
            <WorkspaceSelectItem value="assignee">
              Group: Assignee
            </WorkspaceSelectItem>
            <WorkspaceSelectItem value="priority">
              Group: Priority
            </WorkspaceSelectItem>
            <WorkspaceSelectItem value="none">No grouping</WorkspaceSelectItem>
          </WorkspaceSelect>
        </label>
        {taskView.overdueOnly ? (
          <input name="overdue" type="hidden" value="true" />
        ) : null}
        <WorkspaceButton className="btn btn-sm btn-secondary" type="submit">
          Apply filters
        </WorkspaceButton>
      </form>
      <nav aria-label="Task view" className="row task-view-tabs">
        {(["list", "board", "table"] as const).map((view) => (
          <WorkspaceButton
            asChild
            key={view}
            size="sm"
            variant={taskView.view === view ? "default" : "secondary"}
          >
            <Link
              aria-current={taskView.view === view ? "page" : undefined}
              href={{
                pathname: "/tasks",
                query: { ...params, view },
              }}
            >
              {view[0]?.toLocaleUpperCase()}
              {view.slice(1)}
            </Link>
          </WorkspaceButton>
        ))}
      </nav>
      {taskView.tasks.length ? (
        <GlobalTaskRows
          employees={employeeResult.ok ? employeeResult.data : []}
          favoriteTaskIds={favoriteTaskIds}
          isAdmin={isAdmin}
          taskGroups={taskView.taskGroups}
          userId={userId}
          view={taskView.view}
        />
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
