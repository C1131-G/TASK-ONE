/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
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

const ARCHIVE_ROWS = SKELETON_KEYS.slice(0, 5);

// Mirrors ArchiveWorkspace: the tab labels are static; the rows are data.
const ArchivedWorkSkeleton = () => (
  <section aria-label="Archived work" className="archive-workspace">
    <Tabs value="tasks">
      <TabsList aria-label="Choose archived work type" inert>
        <TabsTrigger value="tasks">Tasks</TabsTrigger>
        <TabsTrigger value="projects">Projects</TabsTrigger>
      </TabsList>
    </Tabs>
    <SkelterSurface label="Loading archived work…">
      <div className="archive-list">
        {ARCHIVE_ROWS.map((key) => (
          <article className="archive-row" key={key}>
            <div className="archive-row-main">
              <SkeletonBone />
              <SkeletonBone shape="short" />
            </div>
            <SkeletonBone shape="control" />
          </article>
        ))}
      </div>
    </SkelterSurface>
  </section>
);

export { ArchivedWork, ArchivedWorkSkeleton };
