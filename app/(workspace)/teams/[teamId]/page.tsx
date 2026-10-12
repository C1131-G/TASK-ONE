/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache, Suspense } from "react";

import { listEmployeesAction } from "@/app/actions/employees";
import { listProjectsAction } from "@/app/actions/projects";
import { listProjectTasksAction } from "@/app/actions/tasks";
import { listTeamsAction } from "@/app/actions/teams";
import { TeamOverview } from "@/components/workspace/team-overview";
import type { TeamTask } from "@/components/workspace/team-overview";
import { getPageSession } from "@/src/server/auth/page-session";

interface TeamPageProps {
  readonly params: Promise<{ readonly teamId: string }>;
}

const loadTeams = cache(() => listTeamsAction({}));

export const generateMetadata = async ({
  params,
}: TeamPageProps): Promise<Metadata> => {
  await connection();
  const [{ teamId }, result] = await Promise.all([params, loadTeams()]);
  const team = result.ok
    ? result.data.find((item) => item.id === teamId)
    : null;
  return { title: `${team?.name ?? "Team"} | Metsys` };
};

const TASK_PAGE_SIZE = 200;

type ProjectTaskResult = Extract<
  Awaited<ReturnType<typeof listProjectTasksAction>>,
  { readonly ok: true }
>;
type ProjectTask = ProjectTaskResult["data"][number];

const listAllProjectTasks = async (
  projectId: string
): Promise<readonly ProjectTask[] | null> => {
  const tasks: ProjectTask[] = [];
  let offset = 0;

  while (true) {
    // eslint-disable-next-line no-await-in-loop -- Each page offset depends on the prior result.
    const result = await listProjectTasksAction({
      limit: TASK_PAGE_SIZE,
      offset,
      projectId,
    });
    if (!result.ok) {
      return null;
    }
    tasks.push(...result.data);
    if (result.data.length < TASK_PAGE_SIZE) {
      return tasks;
    }
    offset += TASK_PAGE_SIZE;
  }
};

const TeamContent = async ({
  params,
}: {
  readonly params: Promise<{ readonly teamId: string }>;
}) => {
  await connection();
  const [{ teamId }, teamsResult, projectsResult, employeesResult, session] =
    await Promise.all([
      params,
      loadTeams(),
      listProjectsAction({}),
      listEmployeesAction({ search: "" }),
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
  if (taskResults.some(({ tasks }) => tasks === null)) {
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

const TeamLoading = () => (
  <output aria-busy="true" aria-live="polite" className="panel panel-b muted">
    Loading team…
  </output>
);

const TeamPage = ({ params }: TeamPageProps) => (
  <div className="page">
    <Suspense fallback={<TeamLoading />}>
      <TeamContent params={params} />
    </Suspense>
  </div>
);

export default TeamPage;
