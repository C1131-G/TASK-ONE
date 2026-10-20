/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { Archive, FolderOpen } from "@phosphor-icons/react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/workspace/empty-state";
import { LocalTime } from "@/components/workspace/local-time";
import { ArchiveRestoreButton } from "@/features/archive/components/archive-restore-button";
import type {
  ArchivedProject,
  ArchivedTask,
} from "@/features/archive/types/archive-workspace-types";

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
                    {task.archivedAt ? (
                      <>
                        {" · Archived "}
                        <LocalTime format="date" value={task.archivedAt} />
                      </>
                    ) : null}
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
          <EmptyState
            description="Archive finished or abandoned tasks to keep boards focused. They wait here until you restore them."
            headingLevel={2}
            icon={Archive}
            size="panel"
            title="No archived tasks"
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
                    {project.archivedAt ? (
                      <>
                        {"Archived "}
                        <LocalTime format="date" value={project.archivedAt} />
                      </>
                    ) : (
                      "Archived project"
                    )}
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
          <EmptyState
            description="Archived projects stay hidden from the workspace until an admin restores them."
            headingLevel={2}
            icon={FolderOpen}
            size="panel"
            title="No archived projects"
          />
        )}
      </TabsContent>
    </Tabs>
  </section>
);

export { ArchiveWorkspace };
