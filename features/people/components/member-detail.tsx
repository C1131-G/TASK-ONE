/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import { notFound } from "next/navigation";
import { connection } from "next/server";

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { listActivity } from "@/features/activity/activity-queries";
import { MemberProfile } from "@/features/people/components/member-profile";
import type { MemberTab } from "@/features/people/member-tab";
import { listEmployees, listTeams } from "@/features/people/people-queries";
import { listProjects } from "@/features/projects/projects-queries";
import { listAllProjectTasks } from "@/features/tasks/tasks-queries";
import { getPageSession } from "@/src/server/auth/page-session";

const MemberDetail = async ({
  employeeId,
  tab,
}: {
  readonly employeeId: string;
  readonly tab: MemberTab;
}) => {
  await connection();
  const [employeesResult, projectsResult, teamsResult, session] =
    await Promise.all([
      listEmployees({ search: "" }),
      listProjects({}),
      listTeams({}),
      getPageSession(),
    ]);

  if (!employeesResult.ok) {
    return (
      <div className="panel panel-b" role="alert">
        Member details could not be loaded. Refresh to retry.
      </div>
    );
  }
  if (!projectsResult.ok) {
    return (
      <div className="panel panel-b" role="alert">
        Member projects could not be loaded. Refresh to retry.
      </div>
    );
  }

  const employee = employeesResult.data.find(({ id }) => id === employeeId);
  if (!employee) {
    notFound();
  }

  const projects = projectsResult.data;
  const [activityResult, projectTaskResults] = await Promise.all([
    listActivity({ actorId: employee.id, limit: 8 }),
    Promise.all(projects.map(({ id }) => listAllProjectTasks(id))),
  ]);
  if (projectTaskResults.some((tasks) => tasks === undefined)) {
    return (
      <div className="panel panel-b" role="alert">
        Member work could not be loaded. Refresh to retry.
      </div>
    );
  }

  const projectsById = new Map(
    projects.map((project) => [project.id, project])
  );
  const memberTasks = projectTaskResults.flatMap((tasks) =>
    (tasks ?? []).flatMap((task) => {
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
      tab={tab}
      teams={teamsResult.ok ? teamsResult.data : []}
      viewerId={session.kind === "authenticated" ? session.user.id : null}
    />
  );
};

// MemberProfile renders its own page frame, so the skeleton does too.
const MemberDetailSkeleton = () => (
  <div className="page member-profile-page">
    <PanelSkeleton label="Loading member profile…" rows={6} title="Member" />
  </div>
);

export { MemberDetail, MemberDetailSkeleton };
