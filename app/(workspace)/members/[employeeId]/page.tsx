/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { listActivityAction } from "@/app/actions/activity";
import { listEmployeesAction } from "@/app/actions/employees";
import { listProjectsAction } from "@/app/actions/projects";
import { listProjectTasksAction } from "@/app/actions/tasks";
import { listTeamsAction } from "@/app/actions/teams";
import { MemberProfile } from "@/components/workspace/member-profile";
import { getPageSession } from "@/src/server/auth/page-session";
import type { ProjectTaskListItemSchema } from "@/src/server/work/work-contracts";

type ProjectTask = typeof ProjectTaskListItemSchema.Type;

export const metadata: Metadata = { title: "Member profile | Metsys" };

const loadProjectTasks = async (projectId: string) => {
  const tasks: ProjectTask[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // eslint-disable-next-line no-await-in-loop -- Continue pagination until the profile has complete work counts.
    const result = await listProjectTasksAction({
      includeArchived: false,
      limit: 200,
      offset,
      projectId,
    });
    if (!result.ok) {
      return { ok: false as const, tasks: [] };
    }
    tasks.push(...result.data);
    hasMore = result.data.length === 200;
    offset += result.data.length;
  }

  return { ok: true as const, tasks };
};

const MemberProfilePage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly employeeId: string }>;
  readonly searchParams: Promise<{ readonly tab?: string | string[] }>;
}) => {
  const [, { employeeId }, query] = await Promise.all([
    connection(),
    params,
    searchParams,
  ]);
  // eslint-disable-next-line react-doctor/server-sequential-independent-await -- Request-time connection must resolve before Server Actions execute.
  const [employeesResult, projectsResult, teamsResult, session] =
    await Promise.all([
      listEmployeesAction({ search: "" }),
      listProjectsAction({}),
      listTeamsAction({}),
      getPageSession(),
    ]);

  if (!employeesResult.ok) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Member details could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }
  if (!projectsResult.ok) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Member projects could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }

  const employee = employeesResult.data.find(({ id }) => id === employeeId);
  if (!employee) {
    notFound();
  }

  const projects = projectsResult.data;
  const [activityResult, projectTaskResults] = await Promise.all([
    listActivityAction({ actorId: employee.id, limit: 8 }),
    Promise.all(projects.map(({ id }) => loadProjectTasks(id))),
  ]);
  if (projectTaskResults.some(({ ok }) => !ok)) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Member work could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }

  const projectsById = new Map(
    projects.map((project) => [project.id, project])
  );
  const memberTasks = projectTaskResults.flatMap(({ tasks }) =>
    tasks.flatMap((task) => {
      if (!task.assigneeIds.includes(employee.id)) {
        return [];
      }
      const project = projectsById.get(task.projectId);
      return project
        ? [{ ...task, projectKey: project.key, projectName: project.name }]
        : [];
    })
  );
  const openTasks = memberTasks
    .filter(({ status }) => status !== "done")
    .toSorted(
      (left, right) =>
        (left.dueDate ?? "9999-12-31").localeCompare(
          right.dueDate ?? "9999-12-31"
        ) || left.title.localeCompare(right.title)
    );
  const completedTasks = memberTasks
    .filter(({ status }) => status === "done")
    .toSorted((left, right) =>
      (right.completedAt ?? "").localeCompare(left.completedAt ?? "")
    );

  return (
    <MemberProfile
      activities={activityResult.ok ? activityResult.data : []}
      canManageMembers={
        session.kind === "authenticated" && session.user.role === "admin"
      }
      completedTasks={completedTasks}
      employee={employee}
      employees={employeesResult.data.map(({ id, name }) => ({ id, name }))}
      isAdmin={
        session.kind === "authenticated" && session.user.role === "admin"
      }
      openTasks={openTasks}
      projects={projects}
      tab={query.tab === "completed" ? "completed" : "assigned"}
      teams={teamsResult.ok ? teamsResult.data : []}
      viewerId={session.kind === "authenticated" ? session.user.id : null}
    />
  );
};

export default MemberProfilePage;
