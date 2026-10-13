/* eslint-disable shadcn/no-unknown-classes -- Project views use reference workspace styles. */

import type { ReactNode } from "react";

import type { listActivityAction } from "@/app/actions/activity";
import type { listBugsAction } from "@/app/actions/bugs";
import type { listCalendarEventsAction } from "@/app/actions/calendar";
import type { listLabelsAction } from "@/app/actions/labels";
import type { listProjectsAction } from "@/app/actions/projects";
import type { listProjectTasksAction } from "@/app/actions/tasks";
import type { listProjectFilesAction } from "@/app/actions/uploads";
import { ProjectActivityFeed } from "@/components/workspace/project-activity-feed";
import { ProjectBoard } from "@/components/workspace/project-board";
import { ProjectBugs } from "@/components/workspace/project-bugs";
import { ProjectFiles } from "@/components/workspace/project-files";
import { ProjectOverview } from "@/components/workspace/project-overview";
import { ProjectTaskViews } from "@/components/workspace/project-task-views";
import { TaskCreateForm } from "@/components/workspace/task-create-form";
import type { currentUtcMonthRange } from "@/src/lib/utc-date-range";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { ProjectMilestone } from "@/src/server/projects/project-contracts";

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

type ProjectTaskActionResult = Awaited<
  ReturnType<typeof listProjectTasksAction>
>;
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
  readonly bugResult: Awaited<ReturnType<typeof listBugsAction>> | null;
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

const renderProjectBugs = ({
  bugResult,
  project,
}: ProjectViewContentProps): ReactNode => {
  if (!bugResult) {
    return null;
  }
  return <ProjectBugs bugResult={bugResult} project={project} />;
};

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
  bugs: renderProjectBugs,
  calendar: renderProjectTasks,
  files: renderProjectFiles,
  list: renderProjectTasks,
  overview: renderProjectOverview,
  table: renderProjectTasks,
  timeline: renderProjectTasks,
};

export const ProjectViewContent = (props: ProjectViewContentProps) =>
  projectViewRenderers[props.view]?.(props) ?? null;
