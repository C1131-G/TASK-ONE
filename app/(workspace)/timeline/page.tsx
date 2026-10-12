/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { listEmployeesAction } from "@/app/actions/employees";
import {
  listProjectMilestonesAction,
  listProjectsAction,
} from "@/app/actions/projects";
import { listTaskCalendarAction } from "@/app/actions/task-calendar";
import { TaskDrawerProvider } from "@/components/workspace/task-drawer";
import { canEditTaskRecord } from "@/components/workspace/task-permissions";
import { WorkspaceTimeline } from "@/components/workspace/workspace-timeline";
import type { TimelineMilestoneLane } from "@/components/workspace/workspace-timeline-types";
import { currentUtcMonthRange } from "@/src/lib/utc-date-range";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "Timeline | Metsys" };

interface TimelineSearchParams {
  readonly task?: string;
}

const TimelineLoading = () => (
  <output aria-busy="true" aria-live="polite" className="panel panel-b muted">
    Loading timeline…
  </output>
);

const TimelineContent = async ({
  searchParams,
}: {
  readonly searchParams: Promise<TimelineSearchParams>;
}) => {
  await connection();
  const [params, session] = await Promise.all([searchParams, getPageSession()]);
  const range = currentUtcMonthRange(0, 4);
  const [result, peopleResult, projectResult] = await Promise.all([
    listTaskCalendarAction({
      from: range.from,
      groupBy: "project",
      limit: 200,
      priorities: [],
      sortBy: "startDate",
      sortDirection: "asc",
      statuses: [],
      to: range.to,
    }),
    listEmployeesAction({ search: "" }),
    listProjectsAction({}),
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
          result: await listProjectMilestonesAction({ projectId: project.id }),
        }))
      )
    : [];
  const milestoneLanes: TimelineMilestoneLane[] = milestoneResults.flatMap(
    ({ project, result: milestoneResult }) =>
      milestoneResult.ok
        ? [
            {
              milestones: milestoneResult.data.milestones.flatMap(
                (milestone) =>
                  milestone.dueDate
                    ? [
                        {
                          completed: milestone.completed,
                          dueDate: milestone.dueDate,
                          id: milestone.id,
                          name: milestone.name,
                        },
                      ]
                    : []
              ),
              projectId: project.id,
              projectName: project.name,
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
    <TaskDrawerProvider
      currentUserId={userId}
      editableTaskIds={editableTaskIds}
      employees={employees}
      initialTaskId={params.task ?? null}
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
    </TaskDrawerProvider>
  );
};

const TimelinePage = ({
  searchParams,
}: {
  readonly searchParams: Promise<TimelineSearchParams>;
}) => (
  <div className="page">
    <div className="ph">
      <div>
        <h1>Timeline</h1>
        <p>Search, filter, and schedule work across active projects.</p>
      </div>
    </div>
    <Suspense fallback={<TimelineLoading />}>
      <TimelineContent searchParams={searchParams} />
    </Suspense>
  </div>
);

export default TimelinePage;
