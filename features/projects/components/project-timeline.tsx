/* eslint-disable shadcn/no-unknown-classes */

import { CaretDown } from "@phosphor-icons/react/dist/ssr";

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import {
  SkeletonKeep,
  SkelterSurface,
} from "@/components/workspace/skelter-surface";
import { listAllTaskCalendar } from "@/features/calendar/calendar-queries";
import { listAllEmployees } from "@/features/people/people-queries";
import { WorkspaceTimeline } from "@/features/projects/components/workspace-timeline";
import {
  listProjectMilestones,
  listProjects,
} from "@/features/projects/projects-queries";
import type { TimelineMilestoneLane } from "@/features/projects/types/workspace-timeline-types";
import { TaskDrawerHost } from "@/features/tasks/components/task-drawer-host";
import { canEditTaskRecord } from "@/features/tasks/task-permissions";
import { currentUtcMonthRange } from "@/src/lib/utc-date-range";
import { getPageSession } from "@/src/server/auth/page-session";

const ProjectTimeline = async ({
  initialTaskId,
}: {
  readonly initialTaskId: string | null;
}) => {
  const session = await getPageSession();
  const range = currentUtcMonthRange(0, 4);
  const [result, peopleResult, projectResult] = await Promise.all([
    listAllTaskCalendar({
      from: range.from,
      groupBy: "project",
      limit: 200,
      priorities: [],
      sortBy: "startDate",
      sortDirection: "asc",
      statuses: [],
      to: range.to,
    }),
    listAllEmployees(),
    listProjects({}),
  ]);
  if (!result.ok) {
    return (
      <div className="panel panel-b" role="alert">
        Timeline could not be loaded. Refresh to retry.
      </div>
    );
  }
  const items = result.data.filter((task) => task.startDate || task.dueDate);
  const userId = session.kind === "authenticated" ? session.user.id : null;
  const isAdmin =
    session.kind === "authenticated" && session.user.role === "admin";
  const milestoneResults = projectResult.ok
    ? await Promise.all(
        projectResult.data.map(async (project) => ({
          project,
          result: await listProjectMilestones({ projectId: project.id }),
        }))
      )
    : [];
  const milestoneLanes: TimelineMilestoneLane[] = milestoneResults.flatMap(
    ({ project, result: milestoneResult }) =>
      milestoneResult.ok
        ? [
            {
              allMilestones: milestoneResult.data.milestones.map(
                ({ completed, dueDate, id, name }) => ({
                  completed,
                  dueDate,
                  id,
                  name,
                })
              ),
              editable: isAdmin,
              projectId: project.id,
              projectName: project.name,
              version: milestoneResult.data.version,
            },
          ]
        : []
  );
  const editableTaskIds = items.flatMap((task) =>
    canEditTaskRecord(task, userId, isAdmin) ? [task.id] : []
  );
  const employees = peopleResult.ok
    ? peopleResult.data.map(({ id, name }) => ({ id, name }))
    : [];

  return (
    <TaskDrawerHost
      currentUserId={userId}
      editableTaskIds={editableTaskIds}
      employees={employees}
      initialTaskId={initialTaskId}
      isAdmin={isAdmin}
      tasks={items.map((task) => ({
        id: task.id,
        projectId: task.projectId,
        title: task.title,
        version: task.version,
      }))}
    >
      <WorkspaceTimeline
        editableTaskIds={editableTaskIds}
        employees={employees}
        from={range.from}
        milestoneLanes={milestoneLanes}
        tasks={items}
        to={range.to}
      />
    </TaskDrawerHost>
  );
};

const TIMELINE_ROWS = SKELETON_KEYS.slice(0, 16);

const SELECTS = [
  "All statuses",
  "All priorities",
  "All assignees",
  "Sort: Manual",
  "Group: Project",
] as const;

// Mirrors WorkspaceTimeline: controls and the "Task" column title are static,
// task names and bars are data.
const ProjectTimelineSkeleton = () => (
  <section
    aria-label="Workspace task timeline"
    className="panel timeline-panel"
  >
    <div className="panel-h timeline-panel-header">
      <h2>Work timeline</h2>
      <div className="toolbar timeline-toolbar" inert>
        <span className="skeleton-filter-select skeleton-search">
          Search tasks
        </span>
        {SELECTS.map((label) => (
          <span className="skeleton-filter-select" key={label}>
            {label}
            <CaretDown aria-hidden="true" size={14} />
          </span>
        ))}
        <span className="timeline-scale">
          <span className="btn btn-secondary">Weeks</span>
          <span className="btn btn-ghost">Months</span>
        </span>
        <span className="btn btn-outline">Today</span>
      </div>
    </div>
    <SkelterSurface label="Loading timeline…">
      <div className="tl workspace-timeline">
        <div className="tl-left">
          <div className="tl-head">
            <SkeletonKeep>Task</SkeletonKeep>
          </div>
          <ul className="tl-rows">
            {TIMELINE_ROWS.map((key) => (
              <li className="tl-row" key={key}>
                <SkeletonBone />
              </li>
            ))}
          </ul>
        </div>
        <div className="tl-right">
          <div className="tl-head skeleton-tl-head">
            <SkeletonBone shape="short" />
          </div>
          <div className="tl-grid skeleton-tl-grid">
            {TIMELINE_ROWS.map((key) => (
              <div className="skeleton-tl-row" key={key}>
                <SkeletonBone shape="short" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkelterSurface>
  </section>
);

export { ProjectTimeline, ProjectTimelineSkeleton };
