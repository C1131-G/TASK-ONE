/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { listProjectsAction } from "@/app/actions/projects";
import { listProjectFilesAction } from "@/app/actions/uploads";
import { ProjectFiles } from "@/components/workspace/project-files";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "Files | Metsys" };

const FilesPage = async () => {
  await connection();
  const [projects, session] = await Promise.all([
    listProjectsAction({}),
    getPageSession(),
  ]);
  if (!projects.ok) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Files could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }
  const fileResults = await Promise.all(
    projects.data.map(async (project) => ({
      files: await listProjectFilesAction({ projectId: project.id }),
      project,
    }))
  );
  const isAdmin =
    session.kind === "authenticated" && session.user.role === "admin";

  return (
    <div className="page wide">
      <div className="ph">
        <div>
          <h1>Files</h1>
          <p>Files shared with your projects.</p>
        </div>
      </div>
      {fileResults.map(({ files, project }) => (
        <section className="stack file-project" key={project.id}>
          <div className="row">
            <h2>{project.name}</h2>
            <span className="sp" />
            <Link
              className="btn btn-sm btn-ghost"
              href={`/projects/${project.id}?view=files` as Route}
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
    </div>
  );
};

export default FilesPage;
