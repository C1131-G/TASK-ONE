/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles -- Project details use reference workspace styles. */

import {
  Bug,
  CalendarBlank,
  ChartLineUp,
  Files,
  List,
  Pulse,
  CaretDown,
  SquaresFour,
  Table,
} from "@phosphor-icons/react/dist/ssr";
import { notFound } from "next/navigation";

import { FavoriteToggle } from "@/components/workspace/favorite-toggle";
import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
import { ProjectAdminControls } from "@/features/projects/components/project-admin-controls";
import { ProjectIcon } from "@/features/projects/components/project-icon";
import { ProjectMemberAvatars } from "@/features/projects/components/project-list-layouts";
import { ProjectSavedViews } from "@/features/projects/components/project-saved-views";
import { ProjectViewContent } from "@/features/projects/components/project-view-content";
import { ProjectViewTabs } from "@/features/projects/components/project-view-tabs";
import { getProjectDetailData } from "@/features/projects/project-detail-data";
import type { ProjectDetailQuery } from "@/features/projects/project-detail-data";
import { ProjectViewStoreProvider } from "@/features/projects/providers/project-view-store-provider";
import { TaskDrawerHost } from "@/features/tasks/components/task-drawer-host";

const ProjectDetail = async ({
  initialTaskId,
  projectId,
  query,
}: {
  readonly initialTaskId: string | null;
  readonly projectId: string;
  readonly query: ProjectDetailQuery;
}) => {
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
      <TaskDrawerHost
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
      </TaskDrawerHost>
    </ProjectViewStoreProvider>
  );
};

const VIEWS = [
  { Icon: SquaresFour, label: "Overview" },
  { Icon: SquaresFour, label: "Board" },
  { Icon: List, label: "List" },
  { Icon: Table, label: "Table" },
  { Icon: Bug, label: "Bugs" },
  { Icon: CalendarBlank, label: "Calendar" },
  { Icon: ChartLineUp, label: "Timeline" },
  { Icon: Files, label: "Files" },
  { Icon: Pulse, label: "Activity" },
] as const;

const COLUMNS = ["Backlog", "To Do", "In Progress", "Review", "Done"] as const;

const COLUMN_CARDS = SKELETON_KEYS.slice(0, 3);

// Mirrors ProjectDetail on its default board view: the "Projects /" crumb, the
// view tabs, the board controls and column names are static; the project name,
// meta and every card are data.
const ProjectDetailSkeleton = () => (
  <div className="page flush">
    <div className="proj-h">
      <div className="row">
        <SkeletonBone shape="avatar" />
        <span className="faint">Projects</span>
        <span className="sep">/</span>
        <h1>
          <SkeletonBone shape="title" />
        </h1>
      </div>
      <p>
        <SkeletonBone />
      </p>
      <div className="row project-meta">
        <SkeletonBone shape="short" />
        <SkeletonBone shape="short" />
      </div>
      <nav aria-label="Project views" className="tabs project-tabs">
        {VIEWS.map(({ Icon, label }) => (
          <span className={`tab${label === "Board" ? " on" : ""}`} key={label}>
            <Icon aria-hidden="true" size={14} />
            {label}
          </span>
        ))}
      </nav>
    </div>
    <div className="project-board-wrap">
      <div aria-hidden="true" className="board-toolbar">
        <span className="skeleton-filter-select skeleton-search board-search">
          Search tasks...
        </span>
        <span className="skeleton-filter-select">
          All priorities
          <CaretDown aria-hidden="true" size={14} />
        </span>
        <span className="skeleton-filter-select">
          Manual order
          <CaretDown aria-hidden="true" size={14} />
        </span>
      </div>
      <SkelterSurface label="Loading project…">
        <div className="board">
          {COLUMNS.map((column) => (
            <section className="bcol" key={column}>
              <header className="bcol-h">
                <span aria-hidden="true" className="st" />
                <SkeletonBone shape="short" />
              </header>
              <div className="bcol-b">
                {COLUMN_CARDS.map((key) => (
                  <div className="kcard" key={key}>
                    <div className="top">
                      <SkeletonBone shape="short" />
                      <SkeletonBone />
                    </div>
                    <div className="meta">
                      <SkeletonBone shape="short" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </SkelterSurface>
    </div>
  </div>
);

export { ProjectDetail, ProjectDetailSkeleton };
