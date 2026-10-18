/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import {
  Briefcase,
  CheckCircle,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { notFound } from "next/navigation";

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
import { TeamOverview } from "@/features/people/components/team-overview";
import type { TeamTask } from "@/features/people/components/team-overview";
import {
  listAllTeams,
  listAllEmployees,
} from "@/features/people/people-queries";
import { listProjects } from "@/features/projects/projects-queries";
import { listAllProjectTasks } from "@/features/tasks/tasks-queries";
import { getPageSession } from "@/src/server/auth/page-session";

const TeamDetail = async ({ teamId }: { readonly teamId: string }) => {
  const [teamsResult, projectsResult, employeesResult, session] =
    await Promise.all([
      listAllTeams(),
      listProjects({}),
      listAllEmployees(),
      getPageSession(),
    ]);

  if (!teamsResult.ok || !projectsResult.ok || !employeesResult.ok) {
    return (
      <div className="panel panel-b" role="alert">
        Team details could not be loaded. Refresh to retry.
      </div>
    );
  }

  const team = teamsResult.data.find(({ id }) => id === teamId);
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

const SECTIONS = [
  { Icon: Briefcase, title: "Projects" },
  { Icon: CheckCircle, title: "Open tasks" },
  { Icon: UsersThree, title: "Members" },
] as const;

const SECTION_ROWS = SKELETON_KEYS.slice(0, 3);

// Mirrors TeamOverview: section titles are static; the team name, counts and
// rows are data.
const TeamDetailSkeleton = () => (
  <div className="team-overview">
    <header className="ph team-overview-heading">
      <div>
        <div className="team-overview-title">
          <SkeletonBone shape="title" />
        </div>
        <p>Projects and people in this team.</p>
      </div>
    </header>
    <div className="team-overview-grid">
      {SECTIONS.map(({ Icon, title }) => (
        <section className="panel" key={title}>
          <div className="panel-h team-overview-section-heading">
            <div className="team-section-title">
              <Icon aria-hidden="true" size={18} />
              <h2>{title}</h2>
            </div>
            <span className="ct">
              <SkeletonBone shape="short" />
            </span>
          </div>
          <SkelterSurface label={`Loading team ${title.toLowerCase()}…`}>
            <div className="panel-b stack">
              {SECTION_ROWS.map((key) => (
                <SkeletonBone key={key} />
              ))}
            </div>
          </SkelterSurface>
        </section>
      ))}
    </div>
  </div>
);

export { TeamDetail, TeamDetailSkeleton };
