/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */

import type { Route } from "next";
import Link from "next/link";

import { ProjectIcon } from "@/components/workspace/project-icon";
import { TaskStatusSelect } from "@/components/workspace/task-status-select";
import type { ActivityEntry } from "@/src/server/activity/activity-management";
import type { ProjectListItem } from "@/src/server/projects/project-contracts";
import type { ProjectTaskListItem } from "@/src/server/work/work-contracts";

const HOME_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export interface HomeTask extends Pick<
  ProjectTaskListItem,
  | "dueDate"
  | "id"
  | "projectId"
  | "projectTaskNumber"
  | "status"
  | "title"
  | "version"
> {
  readonly projectName: string;
  readonly projectKey: string;
  readonly projectColor: string;
}

export interface TaskViewLists {
  readonly upcoming: readonly HomeTask[];
  readonly overdue: readonly HomeTask[];
  readonly completed: readonly HomeTask[];
}

const formatDate = (value: string | null): string => {
  if (!value) {
    return "No due date";
  }
  return HOME_DATE_FORMATTER.format(new Date(`${value}T00:00:00Z`));
};

export const HomeStats = ({
  activeProjects,
  atRisk,
  openTasks,
  assignedTasks,
  completed,
  overdue,
}: {
  readonly activeProjects: number;
  readonly atRisk: number;
  readonly openTasks: number;
  readonly assignedTasks: number;
  readonly completed: number;
  readonly overdue: number;
}) => (
  <div className="stats" style={{ marginBottom: 16 }}>
    <Link className="stat" href={"/projects" as Route}>
      <span className="k">Active projects</span>
      <span className="v">{activeProjects}</span>
      <span className="d">{atRisk} at risk</span>
    </Link>
    <Link className="stat" href={"/tasks" as Route}>
      <span className="k">Open tasks</span>
      <span className="v">{openTasks}</span>
      <span className="d">{assignedTasks} assigned to you</span>
    </Link>
    <Link className="stat" href={"/tasks?status=done" as Route}>
      <span className="k">Completed</span>
      <span className="v">{completed}</span>
      <span className="d">this week</span>
    </Link>
    <Link className="stat" href={"/tasks?overdue=true" as Route}>
      <span className="k">Overdue</span>
      <span
        className="v"
        style={overdue > 0 ? { color: "var(--red)" } : undefined}
      >
        {overdue}
      </span>
      <span className={`d${overdue > 0 ? " bad" : ""}`}>
        {overdue > 0 ? "need attention" : "all on track"}
      </span>
    </Link>
  </div>
);

export const MyTasksPanel = ({
  taskView,
  taskViews,
}: {
  readonly taskView: keyof TaskViewLists;
  readonly taskViews: TaskViewLists;
}) => {
  const visible = taskViews[taskView].slice(0, 7);
  return (
    <section className="panel">
      <div className="panel-h">
        <h2>My tasks</h2>
        <div className="acts">
          <nav aria-label="My task status" className="seg">
            {(["upcoming", "overdue", "completed"] as const).map((tab) => (
              <Link
                aria-current={taskView === tab ? "page" : undefined}
                className={taskView === tab ? "on" : ""}
                href={`/?taskView=${tab}` as Route}
                key={tab}
              >
                {tab[0]?.toUpperCase()}
                {tab.slice(1)}{" "}
                <span className="faint">{taskViews[tab].length}</span>
              </Link>
            ))}
          </nav>
          <Link
            aria-label="Open all my tasks"
            className="ibtn ibtn-sm"
            href={"/my-tasks" as Route}
          >
            ↗
          </Link>
        </div>
      </div>
      {visible.length ? (
        visible.map((task) => (
          <article className="mini home-task-row" key={task.id}>
            <TaskStatusSelect
              status={task.status}
              taskId={task.id}
              version={task.version}
            />
            <Link
              className="trunc grow"
              href={`/projects/${task.projectId}?view=board` as Route}
            >
              {task.title}
            </Link>
            <span className="muted">{task.projectName}</span>
            <span className="num">{formatDate(task.dueDate)}</span>
          </article>
        ))
      ) : (
        <div className="panel-b muted">
          {taskView === "overdue"
            ? "Nothing overdue. Every task assigned to you is on schedule."
            : "No tasks here. Tasks assigned to you appear here."}
        </div>
      )}
      {taskViews[taskView].length > 7 ? (
        <Link className="addrow" href={"/my-tasks" as Route}>
          View all {taskViews[taskView].length} tasks →
        </Link>
      ) : null}
    </section>
  );
};

export const ProjectProgressPanel = ({
  projects,
  teamNames,
}: {
  readonly projects: readonly ProjectListItem[];
  readonly teamNames: ReadonlyMap<string, string>;
}) => (
  <section className="panel">
    <div className="panel-h">
      <h2>Project progress</h2>
      <Link className="btn btn-sm btn-ghost" href={"/projects" as Route}>
        All projects
      </Link>
    </div>
    <div className="list-wrap">
      <table className="perm-t home-progress-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Status</th>
            <th>Progress</th>
            <th>Due</th>
            <th>Team</th>
          </tr>
        </thead>
        <tbody>
          {projects.slice(0, 8).map((project) => (
            <tr key={project.id}>
              <td>
                <Link
                  className="row"
                  href={`/projects/${project.id}?view=overview` as Route}
                >
                  <ProjectIcon
                    color={project.color}
                    icon={project.icon}
                    size={14}
                  />
                  <strong>{project.name}</strong>
                </Link>
              </td>
              <td>
                <span className={`pstatus ${project.status}`}>
                  {project.status}
                </span>
              </td>
              <td>
                <span className="row">
                  <progress
                    aria-label={`${project.progress}% complete`}
                    className="prog"
                    max={100}
                    value={project.progress}
                  />
                  <span className="num faint">{project.progress}%</span>
                </span>
              </td>
              <td className="num muted">{formatDate(project.dueDate)}</td>
              <td className="muted">
                {project.teamId ? teamNames.get(project.teamId) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export const UpcomingDeadlinesPanel = ({
  groups,
}: {
  readonly groups: readonly {
    readonly name: string;
    readonly tasks: readonly HomeTask[];
  }[];
}) => (
  <section className="panel">
    <div className="panel-h">
      <h2>Upcoming deadlines</h2>
      <Link className="btn btn-sm btn-ghost" href={"/calendar" as Route}>
        Calendar
      </Link>
    </div>
    <div className="panel-b stack">
      {groups.map((group) => (
        <div className="deadline-group" key={group.name}>
          <div className="row">
            <strong>{group.name}</strong>
            <span className="faint">{group.tasks.length}</span>
          </div>
          {group.tasks.slice(0, 4).map((task) => (
            <Link
              className="row deadline-row"
              href={`/projects/${task.projectId}?view=board` as Route}
              key={task.id}
            >
              <span
                aria-hidden="true"
                className="pdot"
                style={{ "--c": task.projectColor } as React.CSSProperties}
              />
              <span className="trunc grow">{task.title}</span>
              <span className="muted">
                {task.projectKey}-{task.projectTaskNumber}
              </span>
            </Link>
          ))}
          {group.tasks.length === 0 ? (
            <span className="faint">Nothing due</span>
          ) : null}
          {group.tasks.length > 4 ? (
            <Link className="faint" href={"/calendar" as Route}>
              +{group.tasks.length - 4} more
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  </section>
);

export const RecentActivityPanel = ({
  activities,
}: {
  readonly activities: readonly ActivityEntry[];
}) => (
  <section className="panel">
    <div className="panel-h">
      <h2>Recent activity</h2>
      <Link className="btn btn-sm btn-ghost" href={"/activity" as Route}>
        View all
      </Link>
    </div>
    <div className="panel-b feed lined">
      {activities.length ? (
        activities.map((activity) => (
          <article className="mini" key={activity.id}>
            <span aria-hidden="true" className="av">
              {activity.actorName.slice(0, 1)}
            </span>
            <div className="grow">
              <strong>{activity.actorName}</strong>
              <p className="muted">{activity.action.replaceAll("_", " ")}</p>
            </div>
            <time className="muted" dateTime={activity.createdAt}>
              {activity.createdAt.slice(0, 10)}
            </time>
          </article>
        ))
      ) : (
        <p className="muted">No recent activity.</p>
      )}
    </div>
  </section>
);
