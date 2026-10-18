/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import { ArchiveWorkspace } from "@/features/archive/components/archive-workspace";
import type {
  ArchivedProject,
  ArchivedTask,
} from "@/features/archive/types/archive-workspace-types";
import { listProjects } from "@/features/projects/projects-queries";
import { listAllProjectTasks } from "@/features/tasks/tasks-queries";
import { getPageSession } from "@/src/server/auth/page-session";

const ArchivedWork = async () => {
  const [projectsResult, session] = await Promise.all([
    listProjects({ includeArchived: true }),
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
      tasks: await listAllProjectTasks(project.id, { includeArchived: true }),
    }))
  );
  if (projectResults.some(({ tasks }) => tasks === undefined)) {
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

export { ArchivedWork };
