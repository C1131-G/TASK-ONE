/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { getPersonalWorkspaceAction } from "@/app/actions/discovery";
import { listProjectsAction } from "@/app/actions/projects";
import { FavoriteToggle } from "@/components/workspace/favorite-toggle";
import { ProjectCreateForm } from "@/components/workspace/project-create-form";
import { ProjectIcon } from "@/components/workspace/project-icon";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "Projects | Metsys" };

const statusLabel: Record<string, string> = {
  active: "In Progress",
  complete: "Completed",
  hold: "On Hold",
  planning: "Planning",
  risk: "At Risk",
};

const ProjectsPage = async () => {
  await connection();
  const [result, session, personal] = await Promise.all([
    listProjectsAction({}),
    getPageSession(),
    getPersonalWorkspaceAction({}),
  ]);
  if (!result.ok) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Projects could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }
  const favoriteProjectIds = new Set(
    personal.ok ? personal.data.projects.map((project) => project.id) : []
  );

  return (
    <div className="page">
      <div className="ph">
        <div>
          <h1>Projects</h1>
          <p>Projects across your workspace.</p>
        </div>
      </div>
      {session.kind === "authenticated" && session.user.role === "admin" ? (
        <ProjectCreateForm />
      ) : null}
      {result.data.length ? (
        <div className="pgrid">
          {result.data.map((project) => (
            <article className="pcard" key={project.id}>
              <Link
                aria-label={`Open ${project.name}`}
                className="pcard-link"
                href={`/projects/${project.id}` as Route}
              >
                <div className="row">
                  <ProjectIcon color={project.color} icon={project.icon} />
                  <strong className="trunc grow">{project.name}</strong>
                  <span className={`pstatus ${project.status}`}>
                    {statusLabel[project.status] ?? project.status}
                  </span>
                </div>
                <p className="desc">
                  {project.description || "No description"}
                </p>
                <div className="row">
                  <span
                    aria-label={`${project.progress}% complete`}
                    className="prog"
                  >
                    <span style={{ width: `${project.progress}%` }} />
                  </span>
                  <span className="num">{project.progress}%</span>
                </div>
                <div className="foot">
                  <span>
                    {project.completedTaskCount} of {project.taskCount} tasks
                  </span>
                  <span className="sp" />
                  <span>{project.dueDate ?? "No due date"}</span>
                </div>
              </Link>
              <FavoriteToggle
                id={project.id}
                initialFavorite={favoriteProjectIds.has(project.id)}
                kind="project"
              />
            </article>
          ))}
        </div>
      ) : (
        <section className="panel panel-b">
          <h2>No projects yet</h2>
          <p className="muted">
            An administrator can create the first project.
          </p>
        </section>
      )}
    </div>
  );
};

export default ProjectsPage;
