/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles -- Project details use reference workspace styles. */

import { notFound } from "next/navigation";
import { connection } from "next/server";

import { FavoriteToggle } from "@/components/workspace/favorite-toggle";
import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { ProjectAdminControls } from "@/features/projects/components/project-admin-controls";
import { ProjectIcon } from "@/features/projects/components/project-icon";
import { ProjectMemberAvatars } from "@/features/projects/components/project-list-layouts";
import { ProjectSavedViews } from "@/features/projects/components/project-saved-views";
import { ProjectViewContent } from "@/features/projects/components/project-view-content";
import { ProjectViewTabs } from "@/features/projects/components/project-view-tabs";
import { getProjectDetailData } from "@/features/projects/project-detail-data";
import type { ProjectDetailQuery } from "@/features/projects/project-detail-data";
import { ProjectViewStoreProvider } from "@/features/projects/providers/project-view-store-provider";
import { TaskDrawerProvider } from "@/features/tasks/components/task-drawer";

const ProjectDetail = async ({
  initialTaskId,
  projectId,
  query,
}: {
  readonly initialTaskId: string | null;
  readonly projectId: string;
  readonly query: ProjectDetailQuery;
}) => {
  await connection();
  const model = await getProjectDetailData(projectId, query);
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
        initialTaskId={initialTaskId}
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

const ProjectDetailSkeleton = () => (
  <div className="page flush">
    <PanelSkeleton label="Loading project…" rows={8} title="Project" />
  </div>
);

export { ProjectDetail, ProjectDetailSkeleton };
