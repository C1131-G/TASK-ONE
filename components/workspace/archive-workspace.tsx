/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { Archive, FolderOpen } from "@phosphor-icons/react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArchiveRestoreButton } from "@/components/workspace/archive-restore-button";
import type {
  ArchivedProject,
  ArchivedTask,
} from "@/components/workspace/archive-workspace-types";

const ArchiveEmptyState = ({
  description,
  title,
  type,
}: {
  readonly description: string;
  readonly title: string;
  readonly type: "project" | "task";
}) => {
  const Icon = type === "task" ? Archive : FolderOpen;
  return (
    <div className="archive-empty-state">
      <Icon aria-hidden="true" size={24} />
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
};

const ArchiveWorkspace = ({
  canRestore,
  projects,
  tasks,
}: {
  readonly canRestore: boolean;
  readonly projects: readonly ArchivedProject[];
  readonly tasks: readonly ArchivedTask[];
}) => (
  <section aria-label="Archived work" className="archive-workspace">
    <Tabs defaultValue="tasks">
      <TabsList aria-label="Choose archived work type">
        <TabsTrigger value="tasks">Tasks {tasks.length}</TabsTrigger>
        <TabsTrigger value="projects">Projects {projects.length}</TabsTrigger>
      </TabsList>
      <TabsContent value="tasks">
        {tasks.length ? (
          <div className="archive-list">
            {tasks.map((task) => (
              <article className="archive-row" key={task.id}>
                <div className="archive-row-main">
                  <strong>{task.title}</strong>
                  <span>
                    {task.projectName}
                    {task.archivedAt
                      ? ` · Archived ${task.archivedAt.slice(0, 10)}`
                      : ""}
                  </span>
                </div>
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
          <ArchiveEmptyState
            description="Archive finished or abandoned tasks to keep boards focused. They wait here until you restore them."
            title="No archived tasks"
            type="task"
          />
        )}
      </TabsContent>
      <TabsContent value="projects">
        {projects.length ? (
          <div className="archive-list">
            {projects.map((project) => (
              <article className="archive-row" key={project.id}>
                <div className="archive-row-main">
                  <strong>{project.name}</strong>
                  <span>
                    {project.archivedAt
                      ? `Archived ${project.archivedAt.slice(0, 10)}`
                      : "Archived project"}
                  </span>
                </div>
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
          <ArchiveEmptyState
            description="Archived projects stay hidden from the workspace until an admin restores them."
            title="No archived projects"
            type="project"
          />
        )}
      </TabsContent>
    </Tabs>
  </section>
);

export { ArchiveWorkspace };
