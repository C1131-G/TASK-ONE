/* eslint-disable shadcn/no-unknown-classes */

import Link from "next/link";
import { connection } from "next/server";

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { ProjectFiles } from "@/features/files/components/project-files";
import { listProjectFiles } from "@/features/files/files-queries";
import { listProjects } from "@/features/projects/projects-queries";
import { getPageSession } from "@/src/server/auth/page-session";

const WorkspaceFiles = async () => {
  await connection();
  const [projects, session] = await Promise.all([
    listProjects({}),
    getPageSession(),
  ]);
  if (!projects.ok) {
    return (
      <div className="panel panel-b" role="alert">
        Files could not be loaded. Refresh to retry.
      </div>
    );
  }
  const fileResults = await Promise.all(
    projects.data.map(async (project) => ({
      files: await listProjectFiles({ projectId: project.id }),
      project,
    }))
  );
  const isAdmin =
    session.kind === "authenticated" && session.user.role === "admin";

  return (
    <>
      {fileResults.map(({ files, project }) => (
        <section className="stack file-project" key={project.id}>
          <div className="row">
            <h2>{project.name}</h2>
            <span className="sp" />
            <Link
              className="btn btn-sm btn-ghost"
              href={`/projects/${project.id}?view=files`}
            >
              Open project files
            </Link>
          </div>
          {files.ok ? (
            <ProjectFiles
              canUpload={isAdmin}
              currentUserId={
                session.kind === "authenticated" ? session.user.id : null
              }
              initialFiles={files.data}
              isAdmin={isAdmin}
              projectId={project.id}
            />
          ) : (
            <p className="panel panel-b muted">
              Files are unavailable for this project.
            </p>
          )}
        </section>
      ))}
      {projects.data.length === 0 ? (
        <section className="panel panel-b muted">
          Create a project to start sharing files.
        </section>
      ) : null}
    </>
  );
};

const WorkspaceFilesSkeleton = () => (
  <PanelSkeleton label="Loading project files…" rows={4} />
);

export { WorkspaceFiles, WorkspaceFilesSkeleton };
