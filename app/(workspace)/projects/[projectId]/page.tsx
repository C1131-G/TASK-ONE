/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { listActivityAction } from "@/app/actions/activity";
import { listCalendarEventsAction } from "@/app/actions/calendar";
import { getPersonalWorkspaceAction } from "@/app/actions/discovery";
import { listEmployeesAction } from "@/app/actions/employees";
import {
  listProjectMilestonesAction,
  listProjectsAction,
} from "@/app/actions/projects";
import { listSavedViewsAction } from "@/app/actions/saved-views";
import { listProjectTasksAction } from "@/app/actions/tasks";
import { listTeamsAction } from "@/app/actions/teams";
import { listProjectFilesAction } from "@/app/actions/uploads";
import { FavoriteToggle } from "@/components/workspace/favorite-toggle";
import { ProjectAdminControls } from "@/components/workspace/project-admin-controls";
import { ProjectBoard } from "@/components/workspace/project-board";
import { ProjectFiles } from "@/components/workspace/project-files";
import { ProjectIcon } from "@/components/workspace/project-icon";
import { ProjectMilestones } from "@/components/workspace/project-milestones";
import { ProjectSavedViews } from "@/components/workspace/project-saved-views";
import { ProjectTaskViews } from "@/components/workspace/project-task-views";
import { ProjectViewTabs } from "@/components/workspace/project-view-tabs";
import { TaskCreateForm } from "@/components/workspace/task-create-form";
import { currentUtcMonthRange } from "@/src/lib/utc-date-range";
import { getPageSession } from "@/src/server/auth/page-session";
import type { SavedViewSummary } from "@/src/server/preferences/saved-view-contracts";

export const metadata: Metadata = { title: "Project | Metsys" };

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

const ProjectPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ projectId: string }>;
  readonly searchParams: Promise<{ view?: string; monthOffset?: string }>;
}) => {
  await connection();
  const [{ projectId }, query] = await Promise.all([params, searchParams]);
  const requestedView = query.view ?? "board";
  const [
    session,
    projects,
    taskResult,
    employeeResult,
    personal,
    milestoneResult,
    teamResult,
    savedViewsResult,
  ] = await Promise.all([
    getPageSession(),
    listProjectsAction({}),
    listProjectTasksAction({ limit: 100, offset: 0, projectId }),
    listEmployeesAction({ search: "" }),
    getPersonalWorkspaceAction({}),
    listProjectMilestonesAction({ projectId }),
    listTeamsAction({}),
    listSavedViewsAction({}),
  ]);
  if (!projects.ok) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Project could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }
  const project = projects.data.find((item) => item.id === projectId);
  if (!project) {
    notFound();
  }

  const tasks = taskResult.ok ? taskResult.data : [];
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
  const editableTaskIds = new Set<string>();
  for (const task of tasks) {
    if (
      isAdmin ||
      task.createdById === currentUserId ||
      task.assigneeIds.includes(currentUserId ?? "")
    ) {
      editableTaskIds.add(task.id);
    }
  }
  const favoriteProjectIds = new Set(
    personal.ok ? personal.data.projects.map(({ id }) => id) : []
  );
  const fileResult =
    view === "files" ? await listProjectFilesAction({ projectId }) : null;
  const activityResult =
    view === "activity"
      ? await listActivityAction({ limit: 100, projectId })
      : null;
  const calendarRange =
    view === "calendar" ? currentUtcMonthRange(monthOffset, 1) : null;
  const calendarEvents = calendarRange
    ? await listCalendarEventsAction({
        from: calendarRange.fromInstant,
        to: calendarRange.toInstant,
      })
    : null;
  const timelineRange = view === "timeline" ? currentUtcMonthRange(0, 4) : null;
  const projectCalendarEvents = calendarEvents?.ok
    ? calendarEvents.data.filter((event) => event.projectId === project.id)
    : null;

  return (
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
        <div className="acts">
          <span className={`pstatus ${project.status}`}>{project.status}</span>
          <span className="muted">
            {project.startDate ?? "No start date"} —{" "}
            {project.dueDate ?? "No due date"}
          </span>
        </div>
      </div>
      <ProjectViewTabs projectId={project.id} selected={view} />
      <ProjectSavedViews
        isAdmin={isAdmin}
        projectId={project.id}
        selectedId={savedViewState.selected?.id ?? null}
        userId={currentUserId}
        views={savedViewState.views}
      />
      {isAdmin ? (
        <ProjectAdminControls
          employees={employeeResult.ok ? employeeResult.data : []}
          project={project}
          teams={teamResult.ok ? teamResult.data : []}
        />
      ) : null}

      {view === "overview" ? (
        <div className="grid2">
          <div className="stack">
            <section className="stats">
              <div className="stat">
                <span className="k">Tasks</span>
                <span className="v">{project.taskCount}</span>
                <span className="d">{project.completedTaskCount} complete</span>
              </div>
              <div className="stat">
                <span className="k">Progress</span>
                <span className="v">{project.progress}%</span>
                <span className="d">Current completion</span>
              </div>
              <div className="stat">
                <span className="k">Status</span>
                <span className="v" style={{ fontSize: "var(--fs-lg)" }}>
                  {project.status}
                </span>
                <span className="d">Project health</span>
              </div>
            </section>
            <section className="panel panel-b">
              <h2>About</h2>
              <p>{project.description || "No description"}</p>
            </section>
          </div>
          {milestoneResult.ok ? (
            <ProjectMilestones
              editable={isAdmin}
              initialMilestones={milestoneResult.data.milestones}
              projectId={project.id}
              version={milestoneResult.data.version}
            />
          ) : (
            <section className="panel panel-b muted">
              Milestones could not be loaded.
            </section>
          )}
        </div>
      ) : null}

      {view === "board" ? (
        <>
          <TaskCreateForm projectId={project.id} />
          {taskResult.ok ? (
            <ProjectBoard
              currentUserId={currentUserId}
              employees={employeeResult.ok ? employeeResult.data : []}
              isAdmin={isAdmin}
              projectKey={project.key}
              tasks={tasks}
            />
          ) : (
            <section className="panel panel-b" role="alert">
              Tasks could not be loaded.
            </section>
          )}
        </>
      ) : null}

      {view === "files" && fileResult ? (
        <ProjectFileView
          canUpload={isAdmin}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          projectId={project.id}
          result={fileResult}
        />
      ) : null}

      {view === "activity" ? (
        <section className="panel">
          <div className="panel-h">
            <h2>Project activity</h2>
          </div>
          {activityResult?.ok && activityResult.data.length ? (
            activityResult.data.map((entry) => (
              <article className="mini" key={entry.id}>
                <span className="av">{entry.actorName.slice(0, 1)}</span>
                <div className="grow">
                  <strong>{entry.actorName}</strong>
                  <span className="muted">
                    {" "}
                    {entry.action.replaceAll("_", " ")}
                  </span>
                </div>
                <time className="muted" dateTime={entry.createdAt}>
                  {entry.createdAt.slice(0, 10)}
                </time>
              </article>
            ))
          ) : (
            <div className="panel-b muted">
              {activityResult?.ok
                ? "No project activity yet."
                : "Activity could not be loaded."}
            </div>
          )}
        </section>
      ) : null}

      {["list", "table", "calendar", "timeline"].includes(view) ? (
        <ProjectTaskViews
          calendarEvents={projectCalendarEvents}
          calendarRange={calendarRange}
          currentUserId={currentUserId}
          editableTaskIds={editableTaskIds}
          employees={employeeResult.ok ? employeeResult.data : []}
          isAdmin={isAdmin}
          monthOffset={monthOffset}
          project={project}
          tasks={tasks}
          timelineRange={timelineRange}
          view={view}
        />
      ) : null}
    </div>
  );
};

export default ProjectPage;
