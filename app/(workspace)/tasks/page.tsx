/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */
/* eslint-disable shadcn/no-restyle */

import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { getPersonalWorkspaceAction } from "@/app/actions/discovery";
import { listEmployeesAction } from "@/app/actions/employees";
import { getPersonalPreferencesAction } from "@/app/actions/personal-preferences";
import { listProjectsAction } from "@/app/actions/projects";
import { listProjectTasksAction } from "@/app/actions/tasks";
import { GlobalTasksWorkspace } from "@/components/workspace/global-tasks-workspace";
import { TaskDrawerProvider } from "@/components/workspace/task-drawer";
import { canEditTaskRecord } from "@/components/workspace/task-permissions";
import { columnWidthsFromPreferences } from "@/components/workspace/task-table-columns";
import { GlobalTaskViewStoreProvider } from "@/components/workspace/view-store/global-task-view-store-provider";
import { getUtcToday } from "@/src/lib/utc-today";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "Tasks | Metsys" };

interface TasksSearchParams {
  readonly task?: string;
}

const TasksContent = async ({
  searchParams,
}: {
  readonly searchParams: Promise<TasksSearchParams>;
}) => {
  await connection();
  const [params, projects, session, employeeResult, personal, preferences] =
    await Promise.all([
      searchParams,
      listProjectsAction({}),
      getPageSession(),
      listEmployeesAction({ search: "" }),
      getPersonalWorkspaceAction({}),
      getPersonalPreferencesAction({}),
    ]);
  if (!projects.ok) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Tasks could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }

  const taskLists = await Promise.all(
    projects.data.map(async (project) => ({
      project,
      result: await listProjectTasksAction({
        limit: 100,
        offset: 0,
        projectId: project.id,
      }),
    }))
  );
  const allTasks = taskLists.flatMap(({ project, result }) =>
    result.ok
      ? result.data.map((task) => ({
          ...task,
          projectKey: project.key,
          projectName: project.name,
        }))
      : []
  );
  const userId = session.kind === "authenticated" ? session.user.id : null;
  const isAdmin =
    session.kind === "authenticated" && session.user.role === "admin";
  const editableTaskIds = allTasks.flatMap((task) =>
    canEditTaskRecord(task, userId, isAdmin) ? [task.id] : []
  );
  const employees = employeeResult.ok ? employeeResult.data : [];
  const favoriteTaskIds = new Set(
    personal.ok ? personal.data.tasks.map(({ id }) => id) : []
  );

  return (
    <GlobalTaskViewStoreProvider
      initialColumnWidths={columnWidthsFromPreferences(
        preferences.ok ? preferences.data.taskTableColumnWidths : undefined
      )}
    >
      <TaskDrawerProvider
        currentUserId={userId}
        editableTaskIds={editableTaskIds}
        employees={employees.map(({ id, name }) => ({ id, name }))}
        initialTaskId={params.task ?? null}
        isAdmin={isAdmin}
        tasks={allTasks.map((task) => ({
          id: task.id,
          projectId: task.projectId,
          title: task.title,
          version: task.version,
        }))}
      >
        <GlobalTasksWorkspace
          employees={employees}
          favoriteTaskIds={favoriteTaskIds}
          isAdmin={isAdmin}
          projects={projects.data.map(({ id, name }) => ({ id, name }))}
          tasks={allTasks}
          today={getUtcToday()}
          userId={userId}
        />
      </TaskDrawerProvider>
    </GlobalTaskViewStoreProvider>
  );
};

const TasksLoading = () => (
  <output aria-busy="true" aria-live="polite" className="panel panel-b muted">
    Loading tasks…
  </output>
);

// Request data is read inside Suspense so the route shell can prerender.
const TasksPage = ({
  searchParams,
}: {
  readonly searchParams: Promise<TasksSearchParams>;
}) => (
  <div className="page flush">
    <Suspense fallback={<TasksLoading />}>
      <TasksContent searchParams={searchParams} />
    </Suspense>
  </div>
);

export default TasksPage;
