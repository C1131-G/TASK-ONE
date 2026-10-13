/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in workspace-reference.css. */

import { connection } from "next/server";

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { calendarPeriod } from "@/features/calendar/calendar-params";
import type { CalendarMode } from "@/features/calendar/calendar-params";
import { getPersonalWorkspace } from "@/features/discovery/discovery-queries";
import { listEmployees } from "@/features/people/people-queries";
import { listProjects } from "@/features/projects/projects-queries";
import type { AssignedTask } from "@/features/tasks/components/my-tasks-workspace";
import { MyTasksWorkspace } from "@/features/tasks/components/my-tasks-workspace";
import { TaskDrawerProvider } from "@/features/tasks/components/task-drawer";
import { GlobalTaskViewStoreProvider } from "@/features/tasks/providers/global-task-view-store-provider";
import { canEditTaskRecord } from "@/features/tasks/task-permissions";
import { columnWidthsFromPreferences } from "@/features/tasks/task-table-columns";
import { listProjectTasks } from "@/features/tasks/tasks-queries";
import { getPersonalPreferences } from "@/features/user/user-queries";
import { getPageSession } from "@/src/server/auth/page-session";

const TODAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Kolkata",
  year: "numeric",
});

const dateKey = (): string => TODAY_FORMATTER.format(new Date());

const MyTasks = async ({
  calendarMode,
  initialTaskId,
  monthOffset,
}: {
  readonly calendarMode: CalendarMode;
  readonly initialTaskId: string | null;
  readonly monthOffset: number;
}) => {
  await connection();
  const [session, projectResult, employeeResult, personal, preferences] =
    await Promise.all([
      getPageSession(),
      listProjects({}),
      listEmployees({ search: "" }),
      getPersonalWorkspace({}),
      getPersonalPreferences({}),
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
      result: await listProjectTasks({
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
  const { label: monthLabel } = calendarPeriod(calendarMode, monthOffset);
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
        initialTaskId={initialTaskId}
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

const MyTasksSkeleton = () => (
  <PanelSkeleton label="Loading your tasks…" rows={6} />
);

export { MyTasks, MyTasksSkeleton };
