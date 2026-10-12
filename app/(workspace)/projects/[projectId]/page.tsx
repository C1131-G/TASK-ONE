/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import type { ReactNode } from "react";

import { listActivityAction } from "@/app/actions/activity";
import { listCalendarEventsAction } from "@/app/actions/calendar";
import { getPersonalWorkspaceAction } from "@/app/actions/discovery";
import { listEmployeesAction } from "@/app/actions/employees";
import { listLabelsAction } from "@/app/actions/labels";
import { getPersonalPreferencesAction } from "@/app/actions/personal-preferences";
import {
  listProjectMilestonesAction,
  listProjectsAction,
} from "@/app/actions/projects";
import { listSavedViewsAction } from "@/app/actions/saved-views";
import { listProjectTasksAction } from "@/app/actions/tasks";
import { listTeamsAction } from "@/app/actions/teams";
import { listProjectFilesAction } from "@/app/actions/uploads";
import { FavoriteToggle } from "@/components/workspace/favorite-toggle";
import { ProjectActivityFeed } from "@/components/workspace/project-activity-feed";
import { ProjectAdminControls } from "@/components/workspace/project-admin-controls";
import { ProjectBoard } from "@/components/workspace/project-board";
import { ProjectFiles } from "@/components/workspace/project-files";
import { ProjectIcon } from "@/components/workspace/project-icon";
import { ProjectMemberAvatars } from "@/components/workspace/project-list-layouts";
import { ProjectMilestones } from "@/components/workspace/project-milestones";
import { ProjectOverview } from "@/components/workspace/project-overview";
import { ProjectSavedViews } from "@/components/workspace/project-saved-views";
import { ProjectTaskViews } from "@/components/workspace/project-task-views";
import { ProjectViewTabs } from "@/components/workspace/project-view-tabs";
import { TaskCreateForm } from "@/components/workspace/task-create-form";
import { TaskDrawerProvider } from "@/components/workspace/task-drawer";
import { columnWidthsFromPreferences } from "@/components/workspace/task-table-columns";
import { ProjectViewStoreProvider } from "@/components/workspace/view-store/project-view-store-provider";
import {
  currentUtcMonthRange,
  currentUtcWeekRange,
} from "@/src/lib/utc-date-range";
import { getUtcToday } from "@/src/lib/utc-today";
import { getPageSession } from "@/src/server/auth/page-session";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { SavedViewSummary } from "@/src/server/preferences/saved-view-contracts";
import type { ProjectMilestone } from "@/src/server/projects/project-contracts";

interface ProjectPageProps {
  readonly params: Promise<{ projectId: string }>;
  readonly searchParams: Promise<{
    calendarMode?: string;
    task?: string;
    view?: string;
    monthOffset?: string;
  }>;
}

const loadProjects = cache(() => listProjectsAction({}));

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

type ProjectTaskActionResult = Awaited<
  ReturnType<typeof listProjectTasksAction>
>;
type ProjectTasks = Extract<
  ProjectTaskActionResult,
  { readonly ok: true }
>["data"];

const loadProjectTasks = async (
  projectId: string,
  taskCount: number
): Promise<ProjectTaskActionResult> => {
  const pageSize = 200;
  const pageCount = Math.max(1, Math.ceil(taskCount / pageSize));
  const results = await Promise.all(
    Array.from({ length: pageCount }, (_, pageIndex) =>
      listProjectTasksAction({
        limit: pageSize,
        offset: pageIndex * pageSize,
        projectId,
      })
    )
  );
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
  }
  const [firstResult] = results;
  if (!firstResult) {
    throw new Error("Project task pagination returned no page results.");
  }
  if (!firstResult.ok) {
    return firstResult;
  }
  return {
    data: results.flatMap((result) => (result.ok ? result.data : [])),
    ok: true,
    requestId: firstResult.requestId,
  };
};

const resolveSavedViews = (
  result: Awaited<ReturnType<typeof listSavedViewsAction>>,
  projectId: string,
  userId: string | null,
  requestedView: string
): {
  readonly views: readonly SavedViewSummary[];
  readonly selected: SavedViewSummary | null;
  readonly activeType: string;
} => {
  const views = result.ok
    ? result.data.filter(
        (savedView) =>
          savedView.projectId === projectId &&
          (savedView.userId === userId || savedView.isShared)
      )
    : [];
  const requestedId = requestedView.startsWith("saved-")
    ? requestedView.slice("saved-".length)
    : null;
  const selected =
    views.find((savedView) => savedView.id === requestedId) ?? null;
  return {
    activeType: selected?.type ?? (requestedId ? "board" : requestedView),
    selected,
    views,
  };
};

const ProjectFileView = ({
  result,
  projectId,
  canUpload,
  currentUserId,
  isAdmin,
}: {
  readonly result: Awaited<ReturnType<typeof listProjectFilesAction>>;
  readonly projectId: string;
  readonly canUpload: boolean;
  readonly currentUserId: string | null;
  readonly isAdmin: boolean;
}) => {
  if (result.ok) {
    return (
      <ProjectFiles
        canUpload={canUpload}
        currentUserId={currentUserId}
        initialFiles={result.data}
        isAdmin={isAdmin}
        projectId={projectId}
      />
    );
  }
  return (
    <section className="panel panel-b" role="alert">
      Project files could not be loaded.
    </section>
  );
};

type ProjectActivityActionResult = Awaited<
  ReturnType<typeof listActivityAction>
>;
type ProjectCalendarActionResult = Awaited<
  ReturnType<typeof listCalendarEventsAction>
>;
type ProjectCalendarEvent = Extract<
  ProjectCalendarActionResult,
  { readonly ok: true }
>["data"][number];
type ProjectCalendarRange = ReturnType<typeof currentUtcMonthRange> | null;

interface ProjectViewContentProps {
  readonly activityResult: ProjectActivityActionResult | null;
  readonly calendarEvents: readonly ProjectCalendarEvent[] | null;
  readonly calendarMode: "month" | "week";
  readonly calendarRange: ProjectCalendarRange;
  readonly currentUserId: string | null;
  readonly editableTaskIds: ReadonlySet<string>;
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly fileResult: Awaited<
    ReturnType<typeof listProjectFilesAction>
  > | null;
  readonly labelResult: Awaited<ReturnType<typeof listLabelsAction>>;
  readonly isAdmin: boolean;
  readonly milestonePanel: ReactNode;
  readonly milestones: readonly ProjectMilestone[];
  readonly monthOffset: number;
  readonly project: NonNullable<
    Extract<
      Awaited<ReturnType<typeof listProjectsAction>>,
      { readonly ok: true }
    >["data"][number]
  >;
  readonly taskResult: ProjectTaskActionResult | null;
  readonly tasks: Extract<
    ProjectTaskActionResult,
    { readonly ok: true }
  >["data"];
  readonly teams: readonly { readonly id: string; readonly name: string }[];
  readonly timelineRange: ProjectCalendarRange;
  readonly today: string;
  readonly view: string;
}

const renderProjectOverview = ({
  activityResult,
  currentUserId,
  employees,
  isAdmin,
  milestonePanel,
  project,
  taskResult,
  tasks,
  teams,
  today,
}: ProjectViewContentProps): ReactNode => {
  if (!taskResult?.ok) {
    return (
      <section className="panel panel-b" role="alert">
        Project tasks could not be loaded. Refresh to retry.
      </section>
    );
  }
  return (
    <ProjectOverview
      activity={activityResult?.ok ? activityResult.data : []}
      activityUnavailable={!activityResult?.ok}
      currentUserId={currentUserId}
      employees={employees}
      isAdmin={isAdmin}
      milestones={milestonePanel}
      project={project}
      tasks={tasks}
      teams={teams}
      today={today}
    />
  );
};

const renderProjectBoard = ({
  currentUserId,
  employees,
  isAdmin,
  labelResult,
  project,
  taskResult,
  tasks,
}: ProjectViewContentProps): ReactNode => {
  if (!taskResult?.ok) {
    return (
      <section className="panel panel-b" role="alert">
        Tasks could not be loaded.
      </section>
    );
  }
  return (
    <>
      <TaskCreateForm projectId={project.id} />
      <ProjectBoard
        currentUserId={currentUserId}
        employees={employees}
        isAdmin={isAdmin}
        labels={labelResult.ok ? labelResult.data : []}
        projectKey={project.key}
        tasks={tasks}
      />
    </>
  );
};

const renderProjectFiles = ({
  currentUserId,
  fileResult,
  isAdmin,
  project,
}: ProjectViewContentProps): ReactNode => {
  if (!fileResult) {
    return null;
  }
  return (
    <ProjectFileView
      canUpload={isAdmin}
      currentUserId={currentUserId}
      isAdmin={isAdmin}
      projectId={project.id}
      result={fileResult}
    />
  );
};

const renderProjectActivity = ({
  activityResult,
}: ProjectViewContentProps): ReactNode => (
  <ProjectActivityFeed
    entries={activityResult?.ok ? activityResult.data : []}
    error={!activityResult?.ok}
  />
);

const renderProjectTasks = ({
  calendarEvents,
  calendarMode,
  calendarRange,
  currentUserId,
  editableTaskIds,
  employees,
  isAdmin,
  labelResult,
  milestones,
  monthOffset,
  project,
  taskResult,
  tasks,
  timelineRange,
  view,
}: ProjectViewContentProps): ReactNode => {
  if (!taskResult?.ok) {
    return (
      <section className="panel panel-b" role="alert">
        Project tasks could not be loaded. Refresh to retry.
      </section>
    );
  }
  return (
    <ProjectTaskViews
      calendarEvents={calendarEvents}
      calendarRange={calendarRange}
      calendarMode={calendarMode}
      currentUserId={currentUserId}
      editableTaskIds={editableTaskIds}
      employees={employees}
      isAdmin={isAdmin}
      labels={labelResult.ok ? labelResult.data : []}
      milestones={milestones}
      monthOffset={monthOffset}
      project={project}
      tasks={tasks}
      timelineRange={timelineRange}
      view={view}
    />
  );
};

const projectViewRenderers: Readonly<
  Record<string, (props: ProjectViewContentProps) => ReactNode>
> = {
  activity: renderProjectActivity,
  board: renderProjectBoard,
  calendar: renderProjectTasks,
  files: renderProjectFiles,
  list: renderProjectTasks,
  overview: renderProjectOverview,
  table: renderProjectTasks,
  timeline: renderProjectTasks,
};

const ProjectViewContent = (props: ProjectViewContentProps) =>
  projectViewRenderers[props.view]?.(props) ?? null;

interface ProjectPageQuery {
  readonly calendarMode?: string;
  readonly view?: string;
  readonly monthOffset?: string;
}

const getEditableTaskIds = (
  tasks: ProjectTasks,
  isAdmin: boolean,
  currentUserId: string | null
) => {
  const editableTaskIds = new Set<string>();
  for (const task of tasks) {
    const canEdit =
      isAdmin ||
      task.createdById === currentUserId ||
      task.assigneeIds.includes(currentUserId ?? "");
    if (canEdit) {
      editableTaskIds.add(task.id);
    }
  }
  return editableTaskIds;
};

const getCalendarRange = (
  calendarMode: "month" | "week",
  monthOffset: number
): ProjectCalendarRange =>
  calendarMode === "week"
    ? currentUtcWeekRange(monthOffset)
    : currentUtcMonthRange(monthOffset, 1);

const loadProjectViewData = async ({
  calendarMode,
  isAdmin,
  monthOffset,
  project,
  currentUserId,
  view,
}: {
  readonly calendarMode: "month" | "week";
  readonly currentUserId: string | null;
  readonly isAdmin: boolean;
  readonly monthOffset: number;
  readonly project: Extract<
    Awaited<ReturnType<typeof listProjectsAction>>,
    { readonly ok: true }
  >["data"][number];
  readonly view: string;
}) => {
  const requiresTaskList = [
    "overview",
    "board",
    "list",
    "table",
    "calendar",
    "timeline",
  ].includes(view);
  const taskResult = requiresTaskList
    ? await loadProjectTasks(project.id, project.taskCount)
    : null;
  const tasks = taskResult?.ok ? taskResult.data : [];
  const editableTaskIds = getEditableTaskIds(tasks, isAdmin, currentUserId);
  const [fileResult, activityResult] = await Promise.all([
    view === "files" ? listProjectFilesAction({ projectId: project.id }) : null,
    view === "activity" || view === "overview"
      ? listActivityAction({ limit: 100, projectId: project.id })
      : null,
  ]);
  const calendarRange =
    view === "calendar" ? getCalendarRange(calendarMode, monthOffset) : null;
  const calendarResult = calendarRange
    ? await listCalendarEventsAction({
        from: calendarRange.fromInstant,
        to: calendarRange.toInstant,
      })
    : null;
  const calendarEvents = calendarResult?.ok
    ? calendarResult.data.filter((event) => event.projectId === project.id)
    : null;
  const timelineRange = view === "timeline" ? currentUtcMonthRange(0, 4) : null;
  return {
    activityResult,
    calendarEvents,
    calendarRange,
    editableTaskIds,
    fileResult,
    taskResult,
    tasks,
    timelineRange,
  };
};

const getProjectPageData = async (
  projectId: string,
  query: ProjectPageQuery
) => {
  const requestedView = query.view ?? "board";
  const [
    session,
    projects,
    employeeResult,
    personal,
    milestoneResult,
    teamResult,
    savedViewsResult,
    labelResult,
    preferences,
  ] = await Promise.all([
    getPageSession(),
    loadProjects(),
    listEmployeesAction({ search: "" }),
    getPersonalWorkspaceAction({}),
    listProjectMilestonesAction({ projectId }),
    listTeamsAction({}),
    listSavedViewsAction({}),
    listLabelsAction({}),
    getPersonalPreferencesAction({}),
  ]);
  if (!projects.ok) {
    return { kind: "error" as const };
  }
  const project = projects.data.find((item) => item.id === projectId);
  if (!project) {
    return { kind: "not-found" as const };
  }

  const isAdmin =
    session.kind === "authenticated" && session.user.role === "admin";
  const currentUserId =
    session.kind === "authenticated" ? session.user.id : null;
  const savedViewState = resolveSavedViews(
    savedViewsResult,
    projectId,
    currentUserId,
    requestedView
  );
  const view = savedViewState.activeType;
  const requestedMonthOffset = Number(query.monthOffset ?? 0);
  const monthOffset = Number.isInteger(requestedMonthOffset)
    ? Math.max(-24, Math.min(24, requestedMonthOffset))
    : 0;
  const calendarMode: "month" | "week" =
    query.calendarMode === "week" ? "week" : "month";
  const viewData = await loadProjectViewData({
    calendarMode,
    currentUserId,
    isAdmin,
    monthOffset,
    project,
    view,
  });
  const favoriteProjectIds = new Set(
    personal.ok ? personal.data.projects.map(({ id }) => id) : []
  );
  const milestonePanel = milestoneResult.ok ? (
    <ProjectMilestones
      editable={isAdmin}
      initialMilestones={milestoneResult.data.milestones}
      projectId={project.id}
      version={milestoneResult.data.version}
    />
  ) : (
    <section className="panel panel-b muted" role="alert">
      Milestones could not be loaded.
    </section>
  );

  return {
    ...viewData,
    calendarMode,
    currentUserId,
    employeeResult,
    favoriteProjectIds,
    initialColumnWidths: columnWidthsFromPreferences(
      preferences.ok ? preferences.data.taskTableColumnWidths : undefined
    ),
    isAdmin,
    kind: "ready" as const,
    labelResult,
    milestonePanel,
    milestones: milestoneResult.ok ? milestoneResult.data.milestones : [],
    monthOffset,
    project,
    savedViewState,
    teamResult,
    today: getUtcToday(),
    view,
  };
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
