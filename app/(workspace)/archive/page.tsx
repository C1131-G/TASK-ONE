/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { listProjectsAction } from "@/app/actions/projects";
import { listProjectTasksAction } from "@/app/actions/tasks";
import { ArchiveWorkspace } from "@/components/workspace/archive-workspace";
import type {
  ArchivedProject,
  ArchivedTask,
} from "@/components/workspace/archive-workspace-types";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "Archive | Metsys" };

const TASK_PAGE_SIZE = 200;
type ProjectTaskResult = Extract<
  Awaited<ReturnType<typeof listProjectTasksAction>>,
  { readonly ok: true }
>;
type ProjectTask = ProjectTaskResult["data"][number];

const listAllProjectTasks = async (
  projectId: string
): Promise<ProjectTask[] | null> => {
  const tasks: ProjectTask[] = [];
  let offset = 0;

  while (true) {
    // eslint-disable-next-line no-await-in-loop -- The next offset depends on the page just loaded.
    const result = await listProjectTasksAction({
      includeArchived: true,
      limit: TASK_PAGE_SIZE,
      offset,
      projectId,
    });
    if (!result.ok) {
      return null;
    }
    tasks.push(...result.data);
    if (result.data.length < TASK_PAGE_SIZE) {
      return tasks;
    }
    offset += TASK_PAGE_SIZE;
  }
};

const ArchiveContent = async () => {
  await connection();
  const [projectsResult, session] = await Promise.all([
    listProjectsAction({ includeArchived: true }),
    getPageSession(),
  ]);
  if (!projectsResult.ok) {
    return (
      <div className="panel panel-b" role="alert">
        Archive could not be loaded. Refresh to retry.
      </div>
    );
  }

  const projectResults = await Promise.all(
    projectsResult.data.map(async (project) => ({
      project,
      tasks: await listAllProjectTasks(project.id),
    }))
  );
  if (projectResults.some(({ tasks }) => tasks === null)) {
    return (
      <div className="panel panel-b" role="alert">
        Archived work could not be loaded completely. Refresh to retry.
      </div>
    );
  }

  const projects: ArchivedProject[] = projectsResult.data
    .filter((project) => project.archivedAt !== null)
    .map((project) => ({
      archivedAt: project.archivedAt,
      id: project.id,
      name: project.name,
      version: project.version,
    }));
  const tasks: ArchivedTask[] = projectResults.flatMap(
    ({ project, tasks: projectTasks }) =>
      (projectTasks ?? [])
        .filter((task) => task.archivedAt !== null)
        .map((task) => ({
          archivedAt: task.archivedAt,
          id: task.id,
          projectName: project.name,
          title: task.title,
          version: task.version,
        }))
  );

  return (
    <ArchiveWorkspace
      canRestore={
        session.kind === "authenticated" && session.user.role === "admin"
      }
      projects={projects}
      tasks={tasks}
    />
  );
};

const ArchiveLoading = () => (
  <output
    aria-busy="true"
    aria-live="polite"
    className="archive-loading-state panel panel-b muted"
  >
    Loading archived work…
  </output>
);

const ArchivePage = () => (
  <div className="page">
    <div className="ph">
      <div>
        <h1>Archive</h1>
        <p>
          Archived work is hidden from active views. Restore it when it is
          needed.
        </p>
      </div>
    </div>
    <Suspense fallback={<ArchiveLoading />}>
      <ArchiveContent />
    </Suspense>
  </div>
);

export default ArchivePage;
