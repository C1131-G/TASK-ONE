/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { FavoriteToggle } from "@/components/workspace/favorite-toggle";
import { ProjectAdminControls } from "@/components/workspace/project-admin-controls";
import { ProjectIcon } from "@/components/workspace/project-icon";
import { ProjectMemberAvatars } from "@/components/workspace/project-list-layouts";
import { ProjectSavedViews } from "@/components/workspace/project-saved-views";
import { ProjectViewTabs } from "@/components/workspace/project-view-tabs";
import { TaskDrawerProvider } from "@/components/workspace/task-drawer";
import { ProjectViewStoreProvider } from "@/components/workspace/view-store/project-view-store-provider";

import { getProjectPageData } from "./project-page-data";
import { loadProjects } from "./project-page-loaders";
import { ProjectViewContent } from "./project-view-content";

interface ProjectPageProps {
  readonly params: Promise<{ projectId: string }>;
  readonly searchParams: Promise<{
    calendarMode?: string;
    task?: string;
    view?: string;
    monthOffset?: string;
  }>;
}

export const generateMetadata = async ({
  params,
}: ProjectPageProps): Promise<Metadata> => {
  await connection();
  const [{ projectId }, result] = await Promise.all([params, loadProjects()]);
  const project = result.ok
    ? result.data.find((item) => item.id === projectId)
    : null;
  return { title: `${project?.name ?? "Project"} | Metsys` };
};
const ProjectPage = async ({ params, searchParams }: ProjectPageProps) => {
  await connection();
  const [{ projectId }, query] = await Promise.all([params, searchParams]);
  const model = await getProjectPageData(projectId, query);
  if (model.kind === "error") {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Project could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }
  if (model.kind === "not-found") {
    notFound();
  }
  const {
    activityResult,
    bugResult,
    calendarEvents,
    calendarMode,
    calendarRange,
    initialColumnWidths,
    currentUserId,
    editableTaskIds,
    employeeResult,
    fileResult,
    favoriteProjectIds,
    isAdmin,
    labelResult,
    milestonePanel,
    monthOffset,
    project,
    savedViewState,
    taskResult,
    tasks,
    teamResult,
    milestones,
    milestonesVersion,
    timelineRange,
    today,
    view,
  } = model;
  const employees = employeeResult.ok ? employeeResult.data : [];
  const membersById = new Map(
    employees.map((employee) => [employee.id, employee] as const)
  );
  return (
    <ProjectViewStoreProvider initialColumnWidths={initialColumnWidths}>
      <TaskDrawerProvider
        currentUserId={currentUserId}
        editableTaskIds={[...editableTaskIds]}
        employees={employees}
        initialTaskId={query.task ?? null}
        isAdmin={isAdmin}
        tasks={tasks}
      >
        <div className="page flush">
          <div className="proj-h">
            <div className="row">
              <ProjectIcon color={project.color} icon={project.icon} />
              <span className="faint">Projects</span>
              <span className="sep">/</span>
              <h1>{project.name}</h1>
              <FavoriteToggle
                id={project.id}
                initialFavorite={favoriteProjectIds.has(project.id)}
                kind="project"
              />
            </div>
            <p>{project.description || "Project workspace"}</p>
            <div className="row project-meta">
              <span className={`pstatus ${project.status}`}>
                {project.status}
              </span>
              <span className="muted">
                {project.startDate ?? "No start date"} —{" "}
                {project.dueDate ?? "No due date"}
              </span>
              {project.memberIds.length > 0 ? (
                <ProjectMemberAvatars
                  memberIds={project.memberIds}
                  membersById={membersById}
                />
              ) : null}
              {isAdmin ? (
                <ProjectAdminControls
                  employees={employeeResult.ok ? employeeResult.data : []}
                  project={project}
                  teams={teamResult.ok ? teamResult.data : []}
                />
              ) : null}
            </div>
            <ProjectViewTabs projectId={project.id} selected={view} />
          </div>
          <ProjectSavedViews
            isAdmin={isAdmin}
            projectId={project.id}
            selectedId={savedViewState.selected?.id ?? null}
            userId={currentUserId}
            views={savedViewState.views}
          />
          <ProjectViewContent
            activityResult={activityResult}
            bugResult={bugResult}
            calendarEvents={calendarEvents}
            calendarMode={calendarMode}
            calendarRange={calendarRange}
            currentUserId={currentUserId}
            editableTaskIds={editableTaskIds}
            employees={employees}
            fileResult={fileResult}
            isAdmin={isAdmin}
            labelResult={labelResult}
            milestonePanel={milestonePanel}
            milestones={milestones}
            milestonesVersion={milestonesVersion}
            monthOffset={monthOffset}
            project={project}
            taskResult={taskResult}
            tasks={tasks}
            teams={teamResult.ok ? teamResult.data : []}
            timelineRange={timelineRange}
            today={today}
            view={view}
          />
        </div>
      </TaskDrawerProvider>
    </ProjectViewStoreProvider>
  );
};

export default ProjectPage;
