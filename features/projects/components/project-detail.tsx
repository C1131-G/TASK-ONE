/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles -- Project details use reference workspace styles. */

import {
  Bug,
  CalendarBlank,
  ChartLineUp,
  Files,
  List,
  Pulse,
  CaretDown,
  SealCheck,
  SquaresFour,
  Table,
} from "@phosphor-icons/react/dist/ssr";

import { ViewSwitchTransition } from "@/components/ui/view-switch-transition";
import {
  SKELETON_KEYS,
  SkeletonBone,
  SkeletonRows,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
import { FavoriteToggle } from "@/features/discovery/components/favorite-toggle";
import { ProjectAdminControls } from "@/features/projects/components/project-admin-controls";
import { ProjectClientVisibility } from "@/features/projects/components/project-client-visibility";
import { ProjectIcon } from "@/features/projects/components/project-icon";
import { ProjectMemberAvatars } from "@/features/projects/components/project-list-layouts";
import { ProjectSavedViews } from "@/features/projects/components/project-saved-views";
import { ProjectViewContent } from "@/features/projects/components/project-view-content";
import { ProjectViewTabs } from "@/features/projects/components/project-view-tabs";
import {
  getProjectBodyData,
  getProjectHeaderData,
} from "@/features/projects/project-detail-data";
import type { ProjectDetailQuery } from "@/features/projects/project-detail-data";
import { ProjectViewStoreProvider } from "@/features/projects/providers/project-view-store-provider";
import { TaskDrawerHost } from "@/features/tasks/components/task-drawer-host";

const ProjectHeader = async ({
  projectId,
  requestedView,
}: {
  readonly projectId: string;
  readonly requestedView: string;
}) => {
  const { employees, isAdmin, isFavorite, project, teams, view } =
    await getProjectHeaderData(projectId, requestedView);
  const membersById = new Map(
    employees.map((employee) => [employee.id, employee] as const)
  );
  return (
    <div className="proj-h">
      <div className="row">
        <ProjectIcon color={project.color} icon={project.icon} />
        <span className="faint">Projects</span>
        <span className="sep">/</span>
        <h1>{project.name}</h1>
        <FavoriteToggle
          id={project.id}
          initialFavorite={isFavorite}
          kind="project"
        />
      </div>
      <p>{project.description || "Project workspace"}</p>
      <div className="row project-meta">
        <span className={`pstatus ${project.status}`}>{project.status}</span>
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
          <>
            <ProjectAdminControls
              employees={employees}
              project={project}
              teams={teams}
            />
            <ProjectClientVisibility
              clientVisible={project.clientVisible}
              projectId={project.id}
              version={project.version}
            />
          </>
        ) : null}
      </div>
      <ProjectViewTabs
        isAdmin={isAdmin}
        projectId={project.id}
        selected={view}
      />
    </div>
  );
};

const ProjectBody = async ({
  initialTaskId,
  projectId,
  query,
}: {
  readonly initialTaskId: string | null;
  readonly projectId: string;
  readonly query: ProjectDetailQuery;
}) => {
  const {
    activityResult,
    automationResult,
    bugResult,
    calendarEvents,
    calendarMode,
    calendarRange,
    currentUserId,
    editableTaskIds,
    employeeResult,
    fileResult,
    initialColumnWidths,
    isAdmin,
    labelResult,
    milestonePanel,
    milestones,
    milestonesVersion,
    monthOffset,
    project,
    runResult,
    savedViewState,
    taskResult,
    tasks,
    teamResult,
    timelineRange,
    today,
    view,
  } = await getProjectBodyData(projectId, query);
  const employees = employeeResult.ok ? employeeResult.data : [];
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
        <ProjectSavedViews
          isAdmin={isAdmin}
          projectId={project.id}
          selectedId={savedViewState.selected?.id ?? null}
          userId={currentUserId}
          views={savedViewState.views}
        />
        <ViewSwitchTransition name="project-view" view={view}>
          <ProjectViewContent
            activityResult={activityResult}
            automationResult={automationResult}
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
            runResult={runResult}
            taskResult={taskResult}
            tasks={tasks}
            teams={teamResult.ok ? teamResult.data : []}
            timelineRange={timelineRange}
            today={today}
            view={view}
          />
        </ViewSwitchTransition>
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
  { Icon: SealCheck, label: "Approvals" },
] as const;

const COLUMNS = ["Backlog", "To Do", "In Progress", "Review", "Done"] as const;

const COLUMN_CARDS = SKELETON_KEYS.slice(0, 3);

// The crumb and view tabs are static; the project name and meta are data.
const ProjectHeaderSkeleton = ({
  view = "board",
}: {
  readonly view?: string;
}) => (
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
        <span
          className={`tab${label.toLowerCase() === view ? " on" : ""}`}
          key={label}
        >
          <Icon aria-hidden="true" size={14} />
          {label}
        </span>
      ))}
    </nav>
  </div>
);

const ROW_VIEWS = new Set(["list", "table", "bugs", "files", "activity"]);

// Without a view it is the neutral frame every view shares; once the page has
// read ?view it draws that view's own shape.
const ProjectBodySkeleton = ({ view }: { readonly view?: string }) => {
  if (view === "board") {
    return (
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
    );
  }
  return (
    <SkelterSurface label="Loading project…">
      <section className="panel">
        <div className="panel-b">
          <SkeletonRows rows={view && ROW_VIEWS.has(view) ? 5 : 3} />
        </div>
      </section>
    </SkelterSurface>
  );
};

export {
  ProjectBody,
  ProjectBodySkeleton,
  ProjectHeader,
  ProjectHeaderSkeleton,
};
