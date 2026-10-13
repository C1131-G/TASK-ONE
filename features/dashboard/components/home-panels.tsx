/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */

import type { Route } from "next";
import Link from "next/link";

import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  OpenTasksIcon,
  ViewAllTasksIcon,
} from "@/features/dashboard/components/home-action-icons";
import { ProjectIcon } from "@/features/projects/components/project-icon";
import { ProjectMemberAvatars } from "@/features/projects/components/project-list-layouts";
import { TaskCompletionCheckbox } from "@/features/tasks/components/task-completion-checkbox";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { ProjectListItem } from "@/src/server/projects/project-contracts";
import type { ProjectTaskListItem } from "@/src/server/work/work-contracts";

export { HomeStats } from "@/features/dashboard/components/home-stats";
export { RecentActivityPanel } from "@/features/dashboard/components/home-activity-panel";

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

const projectStatusLabel = (status: ProjectListItem["status"]): string => {
  switch (status) {
    case "active": {
      return "In Progress";
    }
    case "risk": {
      return "At Risk";
    }
    case "complete": {
      return "Completed";
    }
    case "hold": {
      return "On Hold";
    }
    default: {
      return "Planning";
    }
  }
};

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
            <OpenTasksIcon />
          </Link>
        </div>
      </div>
      {visible.length ? (
        visible.map((task) => (
          <article className="mini home-task-row" key={task.id}>
            <TaskCompletionCheckbox
              status={task.status}
              taskId={task.id}
              title={task.title}
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
          View all {taskViews[taskView].length} tasks
          <ViewAllTasksIcon />
        </Link>
      ) : null}
    </section>
  );
};

/* eslint-disable shadcn/no-restyle */
export const ProjectProgressPanel = ({
  projects,
  membersById,
}: {
  readonly projects: readonly ProjectListItem[];
  readonly membersById: ReadonlyMap<string, EmployeeDirectoryEntry>;
}) => (
  <section className="panel">
    <div className="panel-h">
      <h2>Project progress</h2>
      <Link className="btn btn-sm btn-ghost" href={"/projects" as Route}>
        All projects
      </Link>
    </div>
    <Table className="perm-t home-progress-table">
      <TableCaption className="sr-only">Project progress</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Project</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>Team</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.slice(0, 8).map((project) => (
          <TableRow key={project.id}>
            <TableCell>
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
            </TableCell>
            <TableCell>
              <span className={`pstatus ${project.status}`}>
                {projectStatusLabel(project.status)}
              </span>
            </TableCell>
            <TableCell>
              <span className="row">
                <Progress
                  aria-label={`${project.progress}% complete`}
                  max={100}
                  value={project.progress}
                  workspace
                />
                <span className="num faint">{project.progress}%</span>
              </span>
            </TableCell>
            <TableCell className="num muted">
              {formatDate(project.dueDate)}
            </TableCell>
            <TableCell>
              <ProjectMemberAvatars
                memberIds={project.memberIds}
                membersById={membersById}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
