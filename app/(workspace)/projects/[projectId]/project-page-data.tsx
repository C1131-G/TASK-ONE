/* eslint-disable shadcn/no-unknown-classes -- Project details use reference workspace styles. */

import { listActivityAction } from "@/app/actions/activity";
import { listBugsAction } from "@/app/actions/bugs";
import { listCalendarEventsAction } from "@/app/actions/calendar";
import { getPersonalWorkspaceAction } from "@/app/actions/discovery";
import { listEmployeesAction } from "@/app/actions/employees";
import { listLabelsAction } from "@/app/actions/labels";
import { getPersonalPreferencesAction } from "@/app/actions/personal-preferences";
import { listProjectMilestonesAction } from "@/app/actions/projects";
import type { listProjectsAction } from "@/app/actions/projects";
import { listSavedViewsAction } from "@/app/actions/saved-views";
import { listTeamsAction } from "@/app/actions/teams";
import { listProjectFilesAction } from "@/app/actions/uploads";
import { ProjectMilestones } from "@/components/workspace/project-milestones";
import { columnWidthsFromPreferences } from "@/components/workspace/task-table-columns";
import {
  currentUtcMonthRange,
  currentUtcWeekRange,
} from "@/src/lib/utc-date-range";
import { getUtcToday } from "@/src/lib/utc-today";
import { getPageSession } from "@/src/server/auth/page-session";

import {
  loadProjects,
  loadProjectTasks,
  resolveSavedViews,
} from "./project-page-loaders";
import type { ProjectTasks } from "./project-page-loaders";

type ProjectCalendarRange = ReturnType<typeof currentUtcMonthRange> | null;

export interface ProjectPageQuery {
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
  const bugResult =
    view === "bugs" ? await listBugsAction({ projectId: project.id }) : null;
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
    bugResult,
    calendarEvents,
    calendarRange,
    editableTaskIds,
    fileResult,
    taskResult,
    tasks,
    timelineRange,
  };
};

export const getProjectPageData = async (
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
