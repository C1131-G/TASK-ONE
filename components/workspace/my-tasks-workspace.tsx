/* eslint-disable shadcn/no-unknown-classes */

import Link from "next/link";

import { FavoriteToggle } from "@/components/workspace/favorite-toggle";
import { MyTasksCalendar } from "@/components/workspace/my-tasks-calendar";
import { QuickTaskForm } from "@/components/workspace/quick-task-form";
import type { CalendarTask } from "@/components/workspace/task-calendar-grid";
import { TaskManageControls } from "@/components/workspace/task-manage-controls";
import { TaskStatusSelect } from "@/components/workspace/task-status-select";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
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

interface DueGroup {
  readonly id: string;
  readonly label: string;
  readonly tasks: readonly AssignedTask[];
}

interface MyTasksSearchParams {
  readonly calendarMode?: string;
  readonly monthOffset?: string;
  readonly priority?: string;
  readonly q?: string;
  readonly sort?: string;
  readonly status?: string;
  readonly view?: string;
}

interface CalendarProject {
  readonly color: string;
  readonly id: string;
  readonly name: string;
}

interface MyTasksWorkspaceProps {
  readonly calendarMode: "month" | "week";
  readonly calendarProjects: readonly CalendarProject[];
  readonly calendarTasks: readonly CalendarTask[];
  readonly favoriteTaskIds: ReadonlySet<string>;
  readonly groups: readonly DueGroup[];
  readonly isAdmin: boolean;
  readonly monthLabel: string;
  readonly monthOffset: number;
  readonly params: MyTasksSearchParams;
  readonly tasks: readonly AssignedTask[];
  readonly totalAssignedTasks: number;
  readonly userId: string;
  readonly view: "calendar" | "list";
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly dueSummary: string;
}

const TaskRows = ({
  groups,
  favoriteTaskIds,
  employees,
  userId,
  isAdmin,
}: Pick<
  MyTasksWorkspaceProps,
  "groups" | "favoriteTaskIds" | "employees" | "userId" | "isAdmin"
>) => (
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

const TaskResults = (props: MyTasksWorkspaceProps) => {
  if (props.view === "calendar") {
    return (
      <MyTasksCalendar
        monthLabel={props.monthLabel}
        monthOffset={props.monthOffset}
        projects={props.calendarProjects}
        tasks={props.calendarTasks}
        viewMode={props.calendarMode}
        employees={props.employees}
        currentUserId={props.userId}
        isAdmin={props.isAdmin}
      />
    );
  }
  if (props.tasks.length > 0) {
    return (
      <TaskRows
        employees={props.employees}
        favoriteTaskIds={props.favoriteTaskIds}
        groups={props.groups}
        isAdmin={props.isAdmin}
        userId={props.userId}
      />
    );
  }
  const hasTasks = props.totalAssignedTasks > 0;
  return (
    <section className="panel panel-b">
      <h2>
        {hasTasks ? "No tasks match these filters" : "No tasks assigned to you"}
      </h2>
      <p className="muted">
        {hasTasks
          ? "Change the filters to see more of your tasks."
          : "Tasks assigned to your account will appear here."}
      </p>
    </section>
  );
};

const MyTasksWorkspace = (props: MyTasksWorkspaceProps) => (
  <div className="page flush">
    <div className="ph my-tasks-header">
      <div>
        <h1>My Tasks</h1>
        <p>{props.dueSummary || `${props.tasks.length} assigned tasks`}</p>
      </div>
      {props.calendarProjects.length > 0 ? (
        <QuickTaskForm
          projects={props.calendarProjects.map(({ id, name }) => ({
            id,
            name,
          }))}
        />
      ) : null}
      <nav aria-label="My Tasks view" className="row">
        <WorkspaceButton
          asChild
          size="sm"
          variant={props.view === "list" ? "default" : "secondary"}
        >
          <Link
            aria-current={props.view === "list" ? "page" : undefined}
            href="/my-tasks?view=list"
          >
            List
          </Link>
        </WorkspaceButton>
        <WorkspaceButton
          asChild
          size="sm"
          variant={props.view === "calendar" ? "default" : "secondary"}
        >
          <Link
            aria-current={props.view === "calendar" ? "page" : undefined}
            href="/my-tasks?view=calendar"
          >
            Calendar
          </Link>
        </WorkspaceButton>
      </nav>
    </div>
    <form className="toolbar task-filter" method="get">
      <input name="view" type="hidden" value={props.view} />
      {props.view === "calendar" ? (
        <>
          <input name="monthOffset" type="hidden" value={props.monthOffset} />
          <input name="calendarMode" type="hidden" value={props.calendarMode} />
        </>
      ) : null}
      <label className="field" htmlFor="my-tasks-search">
        <WorkspaceInput
          aria-label="Search my tasks"
          defaultValue={props.params.q ?? ""}
          id="my-tasks-search"
          name="q"
          placeholder="Search tasks"
          type="search"
        />
      </label>
      <label className="field" htmlFor="my-tasks-status">
        <WorkspaceSelect
          aria-label="Filter my tasks by status"
          defaultValue={props.params.status ?? "all"}
          id="my-tasks-status"
          name="status"
        >
          <WorkspaceSelectItem value="all">All statuses</WorkspaceSelectItem>
          <WorkspaceSelectItem value="backlog">Backlog</WorkspaceSelectItem>
          <WorkspaceSelectItem value="todo">To Do</WorkspaceSelectItem>
          <WorkspaceSelectItem value="progress">
            In Progress
          </WorkspaceSelectItem>
          <WorkspaceSelectItem value="review">Review</WorkspaceSelectItem>
          <WorkspaceSelectItem value="done">Done</WorkspaceSelectItem>
        </WorkspaceSelect>
      </label>
      <label className="field" htmlFor="my-tasks-priority">
        <WorkspaceSelect
          aria-label="Filter my tasks by priority"
          defaultValue={props.params.priority ?? "all"}
          id="my-tasks-priority"
          name="priority"
        >
          <WorkspaceSelectItem value="all">All priorities</WorkspaceSelectItem>
          <WorkspaceSelectItem value="urgent">Urgent</WorkspaceSelectItem>
          <WorkspaceSelectItem value="high">High</WorkspaceSelectItem>
          <WorkspaceSelectItem value="medium">Medium</WorkspaceSelectItem>
          <WorkspaceSelectItem value="low">Low</WorkspaceSelectItem>
          <WorkspaceSelectItem value="none">No priority</WorkspaceSelectItem>
        </WorkspaceSelect>
      </label>
      <label className="field" htmlFor="my-tasks-sort">
        <WorkspaceSelect
          aria-label="Sort my tasks"
          defaultValue={props.params.sort ?? "due"}
          id="my-tasks-sort"
          name="sort"
        >
          <WorkspaceSelectItem value="due">Sort: Due date</WorkspaceSelectItem>
          <WorkspaceSelectItem value="name">Sort: Name</WorkspaceSelectItem>
          <WorkspaceSelectItem value="priority">
            Sort: Priority
          </WorkspaceSelectItem>
        </WorkspaceSelect>
      </label>
      <WorkspaceButton size="sm" type="submit" variant="secondary">
        Apply filters
      </WorkspaceButton>
    </form>
    <TaskResults {...props} />
  </div>
);

export { MyTasksWorkspace };
