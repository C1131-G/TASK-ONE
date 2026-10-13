/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */

import { connection } from "next/server";

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { getPersonalWorkspace } from "@/features/discovery/discovery-queries";
import { listEmployees } from "@/features/people/people-queries";
import { listProjects } from "@/features/projects/projects-queries";
import { GlobalTasksWorkspace } from "@/features/tasks/components/global-tasks-workspace";
import { TaskDrawerProvider } from "@/features/tasks/components/task-drawer";
import { GlobalTaskViewStoreProvider } from "@/features/tasks/providers/global-task-view-store-provider";
import { canEditTaskRecord } from "@/features/tasks/task-permissions";
import { columnWidthsFromPreferences } from "@/features/tasks/task-table-columns";
import { listProjectTasks } from "@/features/tasks/tasks-queries";
import { getPersonalPreferences } from "@/features/user/user-queries";
import { getUtcToday } from "@/src/lib/utc-today";
import { getPageSession } from "@/src/server/auth/page-session";

/* eslint-disable shadcn/no-restyle */

const AllTasks = async ({
  initialTaskId,
}: {
  readonly initialTaskId: string | null;
}) => {
  await connection();
  const [projects, session, employeeResult, personal, preferences] =
    await Promise.all([
      listProjects({}),
      getPageSession(),
      listEmployees({ search: "" }),
      getPersonalWorkspace({}),
      getPersonalPreferences({}),
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
      result: await listProjectTasks({
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
        initialTaskId={initialTaskId}
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

const AllTasksSkeleton = () => (
  <PanelSkeleton label="Loading tasks…" rows={6} />
);

export { AllTasks, AllTasksSkeleton };
