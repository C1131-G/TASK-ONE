/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import { notFound } from "next/navigation";
import { connection } from "next/server";

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { TeamOverview } from "@/features/people/components/team-overview";
import type { TeamTask } from "@/features/people/components/team-overview";
import { listAllTeams, listEmployees } from "@/features/people/people-queries";
import { listProjects } from "@/features/projects/projects-queries";
import { listAllProjectTasks } from "@/features/tasks/tasks-queries";
import { getPageSession } from "@/src/server/auth/page-session";

const TeamDetail = async ({ teamId }: { readonly teamId: string }) => {
  await connection();
  const [teamsResult, projectsResult, employeesResult, session] =
    await Promise.all([
      listAllTeams(),
      listProjects({}),
      listEmployees({ search: "" }),
      getPageSession(),
    ]);

  if (!teamsResult.ok || !projectsResult.ok || !employeesResult.ok) {
    return (
      <div className="panel panel-b" role="alert">
        Team details could not be loaded. Refresh to retry.
      </div>
    );
  }

  const team = teamsResult.data.find((item) => item.id === teamId);
  if (!team) {
    notFound();
  }

  const projects = projectsResult.data.filter(
    (project) => project.teamId === team.id
  );
  const taskResults = await Promise.all(
    projects.map(async (project) => ({
      project,
      tasks: await listAllProjectTasks(project.id),
    }))
  );
  if (taskResults.some(({ tasks }) => tasks === undefined)) {
    return (
      <div className="panel panel-b" role="alert">
        Team tasks could not be loaded completely. Refresh to retry.
      </div>
    );
  }

  const tasks: TeamTask[] = taskResults.flatMap(({ project, tasks: items }) =>
    (items ?? []).map((task) => ({
      assignees: task.assignees,
      id: task.id,
      projectId: task.projectId,
      projectKey: project.key,
      projectName: project.name,
      projectTaskNumber: task.projectTaskNumber,
      status: task.status,
      title: task.title,
    }))
  );
  const members = employeesResult.data.filter(
    (employee) => employee.teamId === team.id
  );

  return (
    <TeamOverview
      canManage={
        session.kind === "authenticated" && session.user.role === "admin"
      }
      members={members}
      projects={projects}
      tasks={tasks}
      team={team}
      teams={teamsResult.data}
    />
  );
};

const TeamDetailSkeleton = () => (
  <PanelSkeleton label="Loading team…" rows={6} title="Team" />
);

export { TeamDetail, TeamDetailSkeleton };
