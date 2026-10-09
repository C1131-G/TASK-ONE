/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { connection } from "next/server";

import { getPersonalWorkspaceAction } from "@/app/actions/discovery";
import { listEmployeesAction } from "@/app/actions/employees";
import { listProjectsAction } from "@/app/actions/projects";
import { listProjectTasksAction } from "@/app/actions/tasks";
import { FavoriteToggle } from "@/components/workspace/favorite-toggle";
import { TaskManageControls } from "@/components/workspace/task-manage-controls";
import { TaskStatusSelect } from "@/components/workspace/task-status-select";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "My Tasks | Metsys" };

const MyTasksPage = async () => {
  await connection();
  const [session, projectResult, employeeResult, personal] = await Promise.all([
    getPageSession(),
    listProjectsAction({}),
    listEmployeesAction({ search: "" }),
    getPersonalWorkspaceAction({}),
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
      projectName: project.name,
      tasks: await listProjectTasksAction({
        limit: 100,
        offset: 0,
        projectId: project.id,
      }),
    }))
  );
  type TaskResult = Awaited<ReturnType<typeof listProjectTasksAction>>;
  type WorkspaceTask = Extract<
    TaskResult,
    { readonly ok: true }
  >["data"][number];
  const tasks: (WorkspaceTask & { projectName: string })[] = [];
  for (const { projectName, tasks: result } of taskLists) {
    if (!result.ok) {
      continue;
    }
    for (const task of result.data) {
      if (task.assigneeIds.includes(session.user.id)) {
        tasks.push({ ...task, projectName });
      }
    }
  }
  const openTasks = tasks.filter((task) => task.status !== "done");
  const completedTasks = tasks.filter((task) => task.status === "done");
  const favoriteTaskIds = new Set(
    personal.ok ? personal.data.tasks.map(({ id }) => id) : []
  );

  return (
    <div className="page flush">
      <div className="ph">
        <div>
          <h1>My Tasks</h1>
          <p>Tasks assigned to you.</p>
        </div>
      </div>
      {tasks.length ? (
        <div className="list-wrap">
          <div className="tlist task-table-global">
            <div className="thead">
              <div>Task</div>
              <div>Project</div>
              <div>Status</div>
              <div>Priority</div>
              <div>Due date</div>
              <div>Actions</div>
            </div>
            {openTasks.map((task) => (
              <div className="trow" key={task.id}>
                <div className="ttl">
                  <span className="mono faint">{task.projectTaskNumber}</span>
                  <span className="trunc">{task.title}</span>
                </div>
                <div className="c-meta">{task.projectName}</div>
                <div className="c-meta">
                  <TaskStatusSelect
                    status={task.status}
                    taskId={task.id}
                    version={task.version}
                  />
                </div>
                <div className="c-meta">{task.priority}</div>
                <div className="c-meta num">{task.dueDate ?? "—"}</div>
                <div className="c-meta row">
                  <FavoriteToggle
                    id={task.id}
                    initialFavorite={favoriteTaskIds.has(task.id)}
                    kind="task"
                  />
                  <TaskManageControls
                    currentUserId={session.user.id}
                    employees={employeeResult.ok ? employeeResult.data : []}
                    isAdmin={session.user.role === "admin"}
                    task={task}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <section className="panel panel-b">
          <h2>No tasks assigned to you</h2>
          <p className="muted">
            Tasks assigned to your account will appear here.
          </p>
        </section>
      )}
      {completedTasks.length ? (
        <section className="panel">
          <div className="panel-h">
            <h2>Completed</h2>
            <span className="ct">{completedTasks.length}</span>
          </div>
          {completedTasks.map((task) => (
            <div className="mini" key={task.id}>
              <span className="trunc grow">{task.title}</span>
              <span className="muted">{task.projectName}</span>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
};

export default MyTasksPage;
