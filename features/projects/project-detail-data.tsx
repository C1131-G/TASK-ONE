/* eslint-disable shadcn/no-unknown-classes -- Project details use reference workspace styles. */

import { listActivity } from "@/features/activity/activity-queries";
import { listBugs } from "@/features/bugs/bugs-queries";
import { calendarPeriod } from "@/features/calendar/calendar-params";
import type { CalendarMode } from "@/features/calendar/calendar-params";
import { listCalendarEvents } from "@/features/calendar/calendar-queries";
import { getPersonalWorkspace } from "@/features/discovery/discovery-queries";
import { listProjectFiles } from "@/features/files/files-queries";
import { listAllEmployees, listTeams } from "@/features/people/people-queries";
import { ProjectMilestones } from "@/features/projects/components/project-milestones";
import type { listProjects } from "@/features/projects/projects-queries";
import {
  listAllProjects,
  listProjectMilestones,
  listSavedViews,
} from "@/features/projects/projects-queries";
import { resolveSavedViews } from "@/features/projects/saved-view-selection";
import { columnWidthsFromPreferences } from "@/features/tasks/task-table-columns";
import {
  listLabels,
  listProjectTaskPages,
} from "@/features/tasks/tasks-queries";
import { getPersonalPreferences } from "@/features/user/user-queries";
import { currentUtcMonthRange } from "@/src/lib/utc-date-range";
import { getUtcToday } from "@/src/lib/utc-today";
import { getPageSession } from "@/src/server/auth/page-session";

type ProjectTasks = Extract<
  Awaited<ReturnType<typeof listProjectTaskPages>>,
  { readonly ok: true }
>["data"];

export interface ProjectDetailQuery {
  readonly calendarMode: CalendarMode;
  readonly monthOffset: number;
  readonly view: string;
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

const loadProjectViewData = async ({
  calendarMode,
  isAdmin,
  monthOffset,
  project,
  currentUserId,
  view,
}: {
  readonly calendarMode: CalendarMode;
  readonly currentUserId: string | null;
  readonly isAdmin: boolean;
  readonly monthOffset: number;
  readonly project: Extract<
    Awaited<ReturnType<typeof listProjects>>,
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
  const calendarRange =
    view === "calendar"
      ? calendarPeriod(calendarMode, monthOffset).range
      : null;
  const [taskResult, fileResult, activityResult, bugResult, calendarResult] =
    await Promise.all([
      requiresTaskList
        ? listProjectTaskPages(project.id, project.taskCount)
        : Promise.resolve(null),
      view === "files" ? listProjectFiles({ projectId: project.id }) : null,
      view === "activity" || view === "overview"
        ? listActivity({ limit: 100, projectId: project.id })
        : null,
      view === "bugs" ? listBugs({ projectId: project.id }) : null,
      calendarRange
        ? listCalendarEvents({
            from: calendarRange.fromInstant,
            to: calendarRange.toInstant,
          })
        : null,
    ]);
  const tasks = taskResult?.ok ? taskResult.data : [];
  const editableTaskIds = getEditableTaskIds(tasks, isAdmin, currentUserId);
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

export const getProjectDetailData = async (
  projectId: string,
  query: ProjectDetailQuery
) => {
  const requestedView = query.view;
  const [session, projects, savedViewsResult] = await Promise.all([
    getPageSession(),
    listAllProjects(),
    listSavedViews({}),
  ]);
  if (!projects.ok) {
    return { kind: "error" as const };
  }
  const project = projects.data.find(({ id }) => id === projectId);
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
  const [
    employeeResult,
    personal,
    milestoneResult,
    teamResult,
    labelResult,
    preferences,
    viewData,
  ] = await Promise.all([
    listAllEmployees(),
    getPersonalWorkspace({}),
    listProjectMilestones({ projectId }),
    listTeams({}),
    listLabels({}),
    getPersonalPreferences({}),
    loadProjectViewData({
      calendarMode: query.calendarMode,
      currentUserId,
      isAdmin,
      monthOffset: query.monthOffset,
      project,
      view,
    }),
  ]);
  const { calendarMode, monthOffset } = query;
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
    milestonesVersion: milestoneResult.ok ? milestoneResult.data.version : 0,
    monthOffset,
    project,
    savedViewState,
    teamResult,
    today: getUtcToday(),
    view,
  };
};
