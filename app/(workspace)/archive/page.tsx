/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { connection } from "next/server";

import { listProjectsAction } from "@/app/actions/projects";
import { listProjectTasksAction } from "@/app/actions/tasks";
import { ArchiveRestoreButton } from "@/components/workspace/archive-restore-button";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "Archive | Metsys" };

const ArchivePage = async () => {
  await connection();
  const [projectsResult, session] = await Promise.all([
    listProjectsAction({ includeArchived: true }),
    getPageSession(),
  ]);
  if (!projectsResult.ok) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Archive could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }
  const projectRows = projectsResult.data.filter(
    (project) => project.archivedAt !== null
  );
  const taskResults = await Promise.all(
    projectsResult.data.map(async (project) => ({
      project,
      result: await listProjectTasksAction({
        includeArchived: true,
        limit: 200,
        offset: 0,
        projectId: project.id,
      }),
    }))
  );
  const archivedTasks = taskResults.flatMap(({ project, result }) =>
    result.ok
      ? result.data
          .filter((task) => task.archivedAt !== null)
          .map((task) => ({ ...task, projectName: project.name }))
      : []
  );
  const canRestore =
    session.kind === "authenticated" && session.user.role === "admin";

  return (
    <div className="page">
      <div className="ph">
        <div>
          <h1>Archive</h1>
          <p>Archived projects and tasks.</p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-h">
          <h2>Projects</h2>
        </div>
        {projectRows.length ? (
          <div className="panel-b feed lined">
            {projectRows.map((project) => (
              <article className="row" key={project.id}>
                <span className="grow">
                  <strong>{project.name}</strong>
                  <span className="muted">
                    {" "}
                    · {project.archivedAt?.slice(0, 10)}
                  </span>
                </span>
                {canRestore ? (
                  <ArchiveRestoreButton
                    id={project.id}
                    kind="project"
                    version={project.version}
                  />
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="panel-b muted">No archived projects.</div>
        )}
      </section>
      <section className="panel">
        <div className="panel-h">
          <h2>Tasks</h2>
        </div>
        {archivedTasks.length ? (
          <div className="panel-b feed lined">
            {archivedTasks.map((task) => (
              <article className="row" key={task.id}>
                <span className="grow">
                  <strong>{task.title}</strong>
                  <span className="muted"> · {task.projectName}</span>
                </span>
                {canRestore ? (
                  <ArchiveRestoreButton
                    id={task.id}
                    kind="task"
                    version={task.version}
                  />
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="panel-b muted">No archived tasks.</div>
        )}
      </section>
    </div>
  );
};

export default ArchivePage;
