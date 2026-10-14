/* eslint-disable shadcn/no-unknown-classes */

import Link from "next/link";

import { ProjectUpcomingTaskDetails } from "@/features/projects/components/project-upcoming-task-details";
import type { ProjectOverviewTask } from "@/features/projects/types/project-overview-contracts";
import { TaskCompletionCheckbox } from "@/features/tasks/components/task-completion-checkbox";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { ProjectListItem } from "@/src/server/projects/project-contracts";

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
          href={`/projects/${project.id}?view=list`}
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

export { ProjectProgress, ProjectUpcomingTasks };
