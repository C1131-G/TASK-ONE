/* eslint-disable shadcn/no-unknown-classes */

import Link from "next/link";
import { connection } from "next/server";

import { Badge } from "@/components/ui/badge";
import { FavoriteToggle } from "@/components/workspace/favorite-toggle";
import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { getPersonalWorkspace } from "@/features/discovery/discovery-queries";
import { listAllEmployees } from "@/features/people/people-queries";
import { ProjectGridView } from "@/features/projects/components/project-list-layouts";
import { listProjects } from "@/features/projects/projects-queries";
import { TaskCompletionCheckbox } from "@/features/tasks/components/task-completion-checkbox";
import { getPageSession } from "@/src/server/auth/page-session";

const taskStatusLabels = {
  backlog: "Backlog",
  done: "Done",
  progress: "In Progress",
  review: "Review",
  todo: "To Do",
} as const;

const taskPriorityLabels = {
  high: "High",
  low: "Low",
  medium: "Medium",
  none: "No priority",
  urgent: "Urgent",
} as const;

const FavoriteWork = async () => {
  await connection();
  const [personal, projectsResult, employeesResult, session] =
    await Promise.all([
      getPersonalWorkspace({}),
      listProjects({}),
      listAllEmployees(),
      getPageSession(),
    ]);

  if (!personal.ok || !projectsResult.ok) {
    return (
      <div className="panel panel-b" role="alert">
        Favorites could not be loaded. Refresh to retry.
      </div>
    );
  }

  const favoriteProjectIds = new Set(
    personal.data.projects.map((project) => project.id)
  );
  const projects = projectsResult.data.filter((project) =>
    favoriteProjectIds.has(project.id)
  );
  const employees = employeesResult.ok ? employeesResult.data : [];
  const membersById = new Map(
    employees.map((employee) => [employee.id, employee])
  );
  const isAdmin =
    session.kind === "authenticated" && session.user.role === "admin";
  const userId = session.kind === "authenticated" ? session.user.id : "";

  return (
    <>
      <section aria-labelledby="favorite-projects-heading" className="stack">
        <h2 className="section-heading" id="favorite-projects-heading">
          Projects <span className="muted">{projects.length}</span>
        </h2>
        {projects.length ? (
          <ProjectGridView
            favorites={favoriteProjectIds}
            isAdmin={isAdmin}
            membersById={membersById}
            projects={projects}
          />
        ) : (
          <div className="panel panel-b favorite-empty">
            <h3>No favorite projects yet</h3>
            <p className="muted">Star a project to keep it close at hand.</p>
            <Link href="/projects" className="favorite-empty-link">
              Browse projects
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="favorite-tasks-heading" className="stack">
        <h2 className="section-heading" id="favorite-tasks-heading">
          Tasks <span className="muted">{personal.data.tasks.length}</span>
        </h2>
        {personal.data.tasks.length ? (
          <div className="panel favorite-task-list">
            {personal.data.tasks.map((task) => {
              const canEdit =
                isAdmin ||
                task.createdById === userId ||
                task.assignees.some((assignee) => assignee.id === userId);

              return (
                <article className="favorite-task-row" key={task.id}>
                  {canEdit ? (
                    <TaskCompletionCheckbox
                      status={task.status}
                      taskId={task.id}
                      title={task.title}
                      version={task.version}
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="favorite-task-status-dot"
                    />
                  )}
                  <div className="favorite-task-main">
                    <Link
                      className="favorite-task-title"
                      href={`/projects/${task.projectId}?task=${task.id}`}
                    >
                      {task.title}
                    </Link>
                    <Link
                      className="favorite-task-project"
                      href={`/projects/${task.projectId}`}
                    >
                      {task.projectName}
                    </Link>
                    <div className="favorite-task-metadata">
                      <Badge data-task-status={task.status} variant="outline">
                        {taskStatusLabels[task.status]}
                      </Badge>
                      {task.priority === "none" ? null : (
                        <Badge
                          data-task-priority={task.priority}
                          variant="outline"
                        >
                          {taskPriorityLabels[task.priority]}
                        </Badge>
                      )}
                      {task.dueDate ? (
                        <time dateTime={task.dueDate}>{task.dueDate}</time>
                      ) : null}
                    </div>
                    <ul
                      aria-label={`Assignees: ${task.assignees.map(({ name }) => name).join(", ") || "Unassigned"}`}
                      className="favorite-task-assignees"
                    >
                      {task.assignees.slice(0, 3).map((assignee) => (
                        <li aria-label={assignee.name} key={assignee.id}>
                          <span aria-hidden="true" className="av">
                            {assignee.name.slice(0, 1).toUpperCase()}
                          </span>
                        </li>
                      ))}
                      {task.assignees.length > 3 ? (
                        <li className="muted">+{task.assignees.length - 3}</li>
                      ) : null}
                    </ul>
                  </div>
                  <FavoriteToggle id={task.id} initialFavorite kind="task" />
                </article>
              );
            })}
          </div>
        ) : (
          <div className="panel panel-b favorite-empty">
            <h3>No favorite tasks yet</h3>
            <p className="muted">Star tasks to find them quickly here.</p>
            <Link href="/tasks" className="favorite-empty-link">
              Browse tasks
            </Link>
          </div>
        )}
      </section>
    </>
  );
};

const FavoriteWorkSkeleton = () => (
  <>
    <PanelSkeleton
      label="Loading favorite projects…"
      rows={3}
      title="Projects"
    />
    <PanelSkeleton label="Loading favorite tasks…" rows={4} title="Tasks" />
  </>
);

export { FavoriteWork, FavoriteWorkSkeleton };
