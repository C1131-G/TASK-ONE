/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { calendarPeriod } from "@/features/calendar/calendar-params";
import type { CalendarMode } from "@/features/calendar/calendar-params";
import { getPersonalWorkspace } from "@/features/discovery/discovery-queries";
import { listAllEmployees } from "@/features/people/people-queries";
import { listProjects } from "@/features/projects/projects-queries";
import type { AssignedTask } from "@/features/tasks/components/my-tasks-workspace";
import { MyTasksWorkspace } from "@/features/tasks/components/my-tasks-workspace";
import { TaskDrawerHost } from "@/features/tasks/components/task-drawer-host";
import { GlobalTaskViewStoreProvider } from "@/features/tasks/providers/global-task-view-store-provider";
import { canEditTaskRecord } from "@/features/tasks/task-permissions";
import { columnWidthsFromPreferences } from "@/features/tasks/task-table-columns";
import { listAllProjectTasks } from "@/features/tasks/tasks-queries";
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
  const [session, projectResult, employeeResult, personal, preferences] =
    await Promise.all([
      getPageSession(),
      listProjects({}),
      listAllEmployees(),
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
      tasks: await listAllProjectTasks(project.id),
    }))
  );
  if (taskLists.some(({ tasks }) => tasks === undefined)) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Some project tasks could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }
  const assignedTasks: AssignedTask[] = [];
  for (const { project, tasks } of taskLists) {
    for (const task of tasks ?? []) {
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
      <TaskDrawerHost
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
      </TaskDrawerHost>
    </GlobalTaskViewStoreProvider>
  );
};

// The subtitle summarizes due tasks, so the skeleton reserves its line.
const MyTasksSkeleton = () => (
  <>
    <div className="ph my-tasks-header">
      <div>
        <h1>My Tasks</h1>
        <p aria-hidden="true">&nbsp;</p>
      </div>
    </div>
    <PanelSkeleton variant="tasks" label="Loading your tasks…" rows={6} />
  </>
);

export { MyTasks, MyTasksSkeleton };
