/* eslint-disable shadcn/no-unknown-classes -- Project views use reference workspace styles. */

import type { ReactNode } from "react";

import type { listActivity } from "@/features/activity/activity-queries";
import { ProjectActivityFeed } from "@/features/activity/components/project-activity-feed";
import type { listBugs } from "@/features/bugs/bugs-queries";
import { ProjectBugs } from "@/features/bugs/components/project-bugs";
import type { listCalendarEvents } from "@/features/calendar/calendar-queries";
import { ProjectFiles } from "@/features/files/components/project-files";
import type { listProjectFiles } from "@/features/files/files-queries";
import { ProjectBoard } from "@/features/projects/components/project-board";
import { ProjectOverview } from "@/features/projects/components/project-overview";
import { ProjectTaskViews } from "@/features/projects/components/project-task-views";
import type { listProjects } from "@/features/projects/projects-queries";
import { TaskCreateForm } from "@/features/tasks/components/task-create-form";
import type {
  listLabels,
  listProjectTasks,
} from "@/features/tasks/tasks-queries";
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
  readonly result: Awaited<ReturnType<typeof listProjectFiles>>;
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

type ProjectTaskActionResult = Awaited<ReturnType<typeof listProjectTasks>>;
type ProjectActivityActionResult = Awaited<ReturnType<typeof listActivity>>;
type ProjectCalendarActionResult = Awaited<
  ReturnType<typeof listCalendarEvents>
>;
type ProjectCalendarEvent = Extract<
  ProjectCalendarActionResult,
  { readonly ok: true }
>["data"][number];
type ProjectCalendarRange = ReturnType<typeof currentUtcMonthRange> | null;

interface ProjectViewContentProps {
  readonly bugResult: Awaited<ReturnType<typeof listBugs>> | null;
  readonly activityResult: ProjectActivityActionResult | null;
  readonly calendarEvents: readonly ProjectCalendarEvent[] | null;
  readonly calendarMode: "month" | "week";
  readonly calendarRange: ProjectCalendarRange;
  readonly currentUserId: string | null;
  readonly editableTaskIds: ReadonlySet<string>;
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly fileResult: Awaited<ReturnType<typeof listProjectFiles>> | null;
  readonly labelResult: Awaited<ReturnType<typeof listLabels>>;
  readonly isAdmin: boolean;
  readonly milestonePanel: ReactNode;
  readonly milestones: readonly ProjectMilestone[];
  readonly milestonesVersion: number;
  readonly monthOffset: number;
  readonly project: NonNullable<
    Extract<
      Awaited<ReturnType<typeof listProjects>>,
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
      <div className="project-task-create-action">
        <TaskCreateForm projectId={project.id} />
      </div>
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
  milestonesVersion,
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
      milestonesVersion={milestonesVersion}
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
