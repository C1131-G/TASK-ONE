/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in workspace-reference.css. */

import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { getPersonalWorkspaceAction } from "@/app/actions/discovery";
import { listEmployeesAction } from "@/app/actions/employees";
import { getPersonalPreferencesAction } from "@/app/actions/personal-preferences";
import { listProjectsAction } from "@/app/actions/projects";
import { listProjectTasksAction } from "@/app/actions/tasks";
import type { AssignedTask } from "@/components/workspace/my-tasks-workspace";
import { MyTasksWorkspace } from "@/components/workspace/my-tasks-workspace";
import { TaskDrawerProvider } from "@/components/workspace/task-drawer";
import { canEditTaskRecord } from "@/components/workspace/task-permissions";
import { columnWidthsFromPreferences } from "@/components/workspace/task-table-columns";
import { GlobalTaskViewStoreProvider } from "@/components/workspace/view-store/global-task-view-store-provider";
import {
  currentUtcMonthRange,
  currentUtcWeekRange,
} from "@/src/lib/utc-date-range";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "My Tasks | Metsys" };

interface MyTasksSearchParams {
  readonly calendarMode?: string;
  readonly monthOffset?: string;
  readonly task?: string;
}

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});
const WEEK_LABEL_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const TODAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Kolkata",
  year: "numeric",
});

const dateKey = (): string => TODAY_FORMATTER.format(new Date());

const MyTasksContent = async ({
  searchParams,
}: {
  readonly searchParams: Promise<MyTasksSearchParams>;
}) => {
  await connection();
  const [
    params,
    session,
    projectResult,
    employeeResult,
    personal,
    preferences,
  ] = await Promise.all([
    searchParams,
    getPageSession(),
    listProjectsAction({}),
    listEmployeesAction({ search: "" }),
    getPersonalWorkspaceAction({}),
    getPersonalPreferencesAction({}),
  ]);
  if (session.kind !== "authenticated" || !projectResult.ok) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Your tasks could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }

  const taskLists = await Promise.all(
    projectResult.data.map(async (project) => ({
      project,
      result: await listProjectTasksAction({
        limit: 100,
        offset: 0,
        projectId: project.id,
      }),
    }))
  );
  const assignedTasks: AssignedTask[] = [];
  for (const { project, result } of taskLists) {
    if (!result.ok) {
      continue;
    }
    for (const task of result.data) {
      if (task.assigneeIds.includes(session.user.id)) {
        assignedTasks.push({
          ...task,
          projectId: project.id,
          projectKey: project.key,
          projectName: project.name,
        });
      }
    }
  }

  // The calendar range and its label come from the URL on the server; the
  // filters are applied on the client from the store.
  const calendarMode = params.calendarMode === "week" ? "week" : "month";
  const requestedOffset = Number(params.monthOffset ?? 0);
  const monthOffset = Number.isInteger(requestedOffset)
    ? Math.max(-24, Math.min(24, requestedOffset))
    : 0;
  const range =
    calendarMode === "week"
      ? currentUtcWeekRange(monthOffset)
      : currentUtcMonthRange(monthOffset, 1);
  const monthLabel =
    calendarMode === "week"
      ? `${WEEK_LABEL_FORMATTER.format(new Date(`${range.from}T12:00:00Z`))} – ${WEEK_LABEL_FORMATTER.format(new Date(`${range.to}T12:00:00Z`))}`
      : MONTH_LABEL_FORMATTER.format(new Date(`${range.from}T12:00:00Z`));
  const calendarProjects = projectResult.data.map(({ color, id, name }) => ({
    color,
    id,
    name,
  }));

  const isAdmin = session.user.role === "admin";
  const employees = employeeResult.ok ? employeeResult.data : [];
  const editableTaskIds = assignedTasks.flatMap((task) =>
    canEditTaskRecord(task, session.user.id, isAdmin) ? [task.id] : []
  );

  return (
    <GlobalTaskViewStoreProvider
      initialColumnWidths={columnWidthsFromPreferences(
        preferences.ok ? preferences.data.taskTableColumnWidths : undefined
      )}
    >
      <TaskDrawerProvider
        currentUserId={session.user.id}
        editableTaskIds={editableTaskIds}
        employees={employees.map(({ id, name }) => ({ id, name }))}
        initialTaskId={params.task ?? null}
        isAdmin={isAdmin}
        tasks={assignedTasks.map((task) => ({
          id: task.id,
          projectId: task.projectId,
          title: task.title,
          version: task.version,
        }))}
      >
        <MyTasksWorkspace
          calendarMode={calendarMode}
          calendarProjects={calendarProjects}
          employees={employees}
          favoriteTaskIds={
            new Set(personal.ok ? personal.data.tasks.map(({ id }) => id) : [])
          }
          isAdmin={isAdmin}
          monthLabel={monthLabel}
          monthOffset={monthOffset}
          tasks={assignedTasks}
          today={dateKey()}
          userId={session.user.id}
        />
      </TaskDrawerProvider>
    </GlobalTaskViewStoreProvider>
  );
};

const MyTasksLoading = () => (
  <output aria-busy="true" aria-live="polite" className="panel panel-b muted">
    Loading your tasks…
  </output>
);

// Request data is read inside Suspense so the route shell can prerender.
const MyTasksPage = ({
  searchParams,
}: {
  readonly searchParams: Promise<MyTasksSearchParams>;
}) => (
  <div className="page flush">
    <Suspense fallback={<MyTasksLoading />}>
      <MyTasksContent searchParams={searchParams} />
    </Suspense>
  </div>
);

export default MyTasksPage;
