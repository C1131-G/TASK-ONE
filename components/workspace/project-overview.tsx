/* eslint-disable shadcn/no-unknown-classes */

import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { ProjectUpcomingTaskDetails } from "@/components/workspace/project-upcoming-task-details";
import { TaskCompletionCheckbox } from "@/components/workspace/task-completion-checkbox";
import type { ActivityEntry } from "@/src/server/activity/activity-management";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { ProjectListItem } from "@/src/server/projects/project-contracts";
import type { ProjectTaskListItem } from "@/src/server/work/work-contracts";

type ProjectOverviewTask = Pick<
  ProjectTaskListItem,
  | "assigneeIds"
  | "assignees"
  | "createdById"
  | "dependencyIds"
  | "dueDate"
  | "id"
  | "labelIds"
  | "projectId"
  | "recurrence"
  | "status"
  | "title"
  | "version"
>;

const TASK_STATUS_ORDER = [
  { label: "Backlog", value: "backlog" },
  { label: "To Do", value: "todo" },
  { label: "In Progress", value: "progress" },
  { label: "Review", value: "review" },
  { label: "Done", value: "done" },
] as const;

const getDaysUntil = (date: string, today: string): number =>
  Math.ceil(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86_400_000
  );

const ProjectProgress = ({
  project,
  tasks,
  today,
}: {
  readonly project: ProjectListItem;
  readonly tasks: readonly ProjectOverviewTask[];
  readonly today: string;
}) => {
  const statusCounts = new Map<string, number>();
  for (const { status } of tasks) {
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }
  const overdueTasks = tasks.filter(
    (task) => task.dueDate && task.dueDate < today && task.status !== "done"
  ).length;
  const daysUntilDue = project.dueDate
    ? getDaysUntil(project.dueDate, today)
    : null;
  let deadlineSummary = "No project deadline";
  if (daysUntilDue !== null) {
    deadlineSummary =
      daysUntilDue < 0
        ? `${Math.abs(daysUntilDue)} days past due`
        : `${daysUntilDue} days until ${project.dueDate}`;
  }

  return (
    <section aria-labelledby="project-progress-heading" className="panel">
      <div className="panel-h project-overview-progress-heading">
        <div>
          <h2 id="project-progress-heading">Progress</h2>
          <p className="muted">
            {project.completedTaskCount} of {project.taskCount} tasks done
          </p>
        </div>
        <strong className="project-overview-percent">
          {project.progress}%
        </strong>
      </div>
      <progress
        aria-label={`Project ${project.progress}% complete`}
        className="project-overview-progress-track"
        max={100}
        value={project.progress}
      />
      <p className="project-overview-progress-meta">
        {deadlineSummary}
        {overdueTasks > 0 ? ` · ${overdueTasks} overdue` : ""}
      </p>
      <ul className="project-status-breakdown">
        {TASK_STATUS_ORDER.map(({ label, value }) => {
          const count = statusCounts.get(value) ?? 0;
          const share =
            project.taskCount === 0
              ? 0
              : Math.round((count / project.taskCount) * 100);
          return (
            <li key={value}>
              <span
                aria-hidden="true"
                className={`project-status-dot ${value}`}
              />
              <span className="project-status-label">{label}</span>
              <span className="project-status-count">{count}</span>
              <meter
                aria-label={`${share}% ${label}`}
                className={`project-status-track ${value}`}
                max={100}
                min={0}
                value={share}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const ProjectUpcomingTasks = ({
  currentUserId,
  employees,
  isAdmin,
  project,
  tasks,
  today,
}: {
  readonly currentUserId: string | null;
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly isAdmin: boolean;
  readonly project: ProjectListItem;
  readonly tasks: readonly ProjectOverviewTask[];
  readonly today: string;
}) => {
  const upcomingTasks = tasks
    .filter(
      (task) => task.dueDate && task.dueDate >= today && task.status !== "done"
    )
    .toSorted((first, second) =>
      (first.dueDate ?? "").localeCompare(second.dueDate ?? "")
    )
    .slice(0, 6);

  return (
    <section aria-labelledby="project-coming-up-heading" className="panel">
      <div className="panel-h">
        <h2 id="project-coming-up-heading">Coming up</h2>
        <Link
          className="project-overview-text-link"
          href={`/projects/${project.id}?view=list` as Route}
        >
          View list
        </Link>
      </div>
      {upcomingTasks.length > 0 ? (
        <ul className="project-upcoming-list">
          {upcomingTasks.map((task) => {
            const canEdit =
              isAdmin ||
              task.createdById === currentUserId ||
              task.assigneeIds.includes(currentUserId ?? "");
            return (
              <li className="project-upcoming-item" key={task.id}>
                {canEdit ? (
                  <TaskCompletionCheckbox
                    status={task.status}
                    taskId={task.id}
                    title={task.title}
                    version={task.version}
                  />
                ) : (
                  <span aria-hidden="true" className="project-upcoming-empty" />
                )}
                <ProjectUpcomingTaskDetails
                  canEdit={canEdit}
                  currentUserId={currentUserId}
                  employees={employees}
                  isAdmin={isAdmin}
                  task={task}
                />
                <span className="project-upcoming-assignees">
                  {task.assignees.map((assignee) => (
                    <span
                      className="project-overview-assignee"
                      key={assignee.id}
                    >
                      <span
                        aria-hidden="true"
                        className="project-overview-avatar"
                        title={assignee.name}
                      >
                        {assignee.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="sr-only">{assignee.name}</span>
                    </span>
                  ))}
                </span>
                <time
                  className="project-upcoming-date"
                  dateTime={task.dueDate ?? undefined}
                >
                  {task.dueDate}
                </time>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="project-overview-empty">No upcoming tasks.</p>
      )}
    </section>
  );
};

const ProjectDetails = ({
  employees,
  project,
  teams,
}: {
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly project: ProjectListItem;
  readonly teams: readonly { readonly id: string; readonly name: string }[];
}) => {
  const lead = employees.find((employee) => employee.id === project.leadId);
  const team = teams.find(({ id }) => id === project.teamId);
  const memberIds = new Set(project.memberIds);
  const members = employees.filter((employee) => memberIds.has(employee.id));

  return (
    <section aria-labelledby="project-details-heading" className="panel">
      <div className="panel-h">
        <h2 id="project-details-heading">Details</h2>
      </div>
      <dl className="project-overview-details">
        <div>
          <dt>Status</dt>
          <dd>
            <span className={`pstatus ${project.status}`}>
              {project.status}
            </span>
          </dd>
        </div>
        <div>
          <dt>Lead</dt>
          <dd>{lead?.name ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt>Team</dt>
          <dd>
            {team ? (
              <Link href={`/teams/${team.id}` as Route}>{team.name}</Link>
            ) : (
              "No team"
            )}
          </dd>
        </div>
        <div>
          <dt>Start</dt>
          <dd>{project.startDate ?? "Not set"}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{project.dueDate ?? "Not set"}</dd>
        </div>
        <div className="project-overview-members-row">
          <dt>Members</dt>
          <dd>
            {members.length > 0 ? (
              <ul
                aria-label="Project members"
                className="project-overview-members"
              >
                {members.map((member) => (
                  <li key={member.id}>
                    <span
                      aria-hidden="true"
                      className="project-overview-avatar"
                      title={member.name}
                    >
                      {member.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="sr-only">{member.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              "No members"
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
};

const ProjectRecentActivity = ({
  activity,
  unavailable,
  projectId,
}: {
  readonly activity: readonly ActivityEntry[];
  readonly unavailable: boolean;
  readonly projectId: string;
}) => {
  let activityContent: ReactNode;
  if (unavailable) {
    activityContent = (
      <p className="project-overview-empty" role="alert">
        Recent activity could not be loaded.
      </p>
    );
  } else if (activity.length === 0) {
    activityContent = (
      <p className="project-overview-empty">No project activity yet.</p>
    );
  } else {
    activityContent = (
      <ul className="project-overview-activity">
        {activity.slice(0, 6).map((entry) => (
          <li key={entry.id}>
            <span aria-hidden="true" className="project-overview-avatar">
              {entry.actorName.slice(0, 1).toUpperCase()}
            </span>
            <div className="project-overview-activity-copy">
              <p>
                <strong>{entry.actorName}</strong>{" "}
                {entry.action.replaceAll("_", " ")}
              </p>
              {entry.taskTitle ? (
                <span className="muted">{entry.taskTitle}</span>
              ) : null}
            </div>
            <time dateTime={entry.createdAt}>
              {entry.createdAt.slice(0, 10)}
            </time>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section
      aria-labelledby="project-recent-activity-heading"
      className="panel"
    >
      <div className="panel-h">
        <h2 id="project-recent-activity-heading">Recent activity</h2>
        <Link
          className="project-overview-text-link"
          href={`/projects/${projectId}?view=activity` as Route}
        >
          View all
        </Link>
      </div>
      {activityContent}
    </section>
  );
};

const ProjectOverview = ({
  activity,
  activityUnavailable,
  currentUserId,
  employees,
  isAdmin,
  milestones,
  project,
  tasks,
  teams,
  today,
}: {
  readonly activity: readonly ActivityEntry[];
  readonly activityUnavailable: boolean;
  readonly currentUserId: string | null;
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly isAdmin: boolean;
  readonly milestones: ReactNode;
  readonly project: ProjectListItem;
  readonly tasks: readonly ProjectOverviewTask[];
  readonly teams: readonly { readonly id: string; readonly name: string }[];
  readonly today: string;
}) => (
  <div className="project-overview">
    <div className="project-overview-main">
      <section aria-labelledby="project-about-heading" className="panel">
        <div className="panel-h">
          <h2 id="project-about-heading">About</h2>
        </div>
        <p className="project-overview-about">
          {project.description || "No project description has been added."}
        </p>
      </section>
      <ProjectProgress project={project} tasks={tasks} today={today} />
      <ProjectUpcomingTasks
        currentUserId={currentUserId}
        employees={employees}
        isAdmin={isAdmin}
        project={project}
        tasks={tasks}
        today={today}
      />
    </div>
    <aside
      aria-label="Project details and updates"
      className="project-overview-aside"
    >
      <ProjectDetails employees={employees} project={project} teams={teams} />
      {milestones}
      <ProjectRecentActivity
        activity={activity}
        projectId={project.id}
        unavailable={activityUnavailable}
      />
    </aside>
  </div>
);

export { ProjectOverview };
