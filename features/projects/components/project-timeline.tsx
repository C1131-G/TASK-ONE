/* eslint-disable shadcn/no-unknown-classes */

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

export { ProjectTimeline };
