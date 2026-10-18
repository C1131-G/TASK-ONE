/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
import { listActivity } from "@/features/activity/activity-queries";
import { MemberProfile } from "@/features/people/components/member-profile";
import type { MemberTab } from "@/features/people/member-tab";
import { listAllEmployees, listTeams } from "@/features/people/people-queries";
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
  const [employeesResult, projectsResult, teamsResult, session] =
    await Promise.all([
      listAllEmployees(),
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

const STATS = [
  "Active projects",
  "Assigned tasks",
  "Completed tasks",
  "Overdue",
] as const;

const TASK_ROWS = SKELETON_KEYS.slice(0, 5);

const SIDE_ROWS = SKELETON_KEYS.slice(0, 3);

// Mirrors MemberProfile: the back link, stat labels and panel titles are
// static; the person, counts and rows are data.
const MemberDetailSkeleton = () => (
  <div className="page member-profile-page">
    <Link className="member-profile-back" href="/members">
      <ArrowLeft aria-hidden="true" size={14} />
      All members
    </Link>
    <SkelterSurface label="Loading member profile…">
      <header className="member-profile-header">
        <SkeletonBone shape="avatar" />
        <div className="member-profile-identity">
          <div className="member-profile-name-row">
            <SkeletonBone shape="title" />
          </div>
          <p className="member-profile-job">
            <SkeletonBone />
          </p>
          <p className="member-profile-email">
            <SkeletonBone />
          </p>
        </div>
      </header>
    </SkelterSurface>
    <div className="stats member-profile-stats">
      {STATS.map((label) => (
        <div className="stat" key={label}>
          <span className="k">{label}</span>
          <span className="v">
            <SkeletonBone shape="short" />
          </span>
        </div>
      ))}
    </div>
    <div className="member-profile-grid">
      <section aria-label="Assigned tasks" className="panel">
        <nav aria-label="Member task filters" className="member-profile-tabs">
          <Link aria-current="page" href="/members">
            Assigned
          </Link>
          <Link href="/members">Completed</Link>
        </nav>
        <SkelterSurface label="Loading member tasks…">
          {TASK_ROWS.map((key) => (
            <div className="row skeleton-feed-row" key={key}>
              <div className="skeleton-copy grow">
                <SkeletonBone />
                <SkeletonBone shape="short" />
              </div>
              <SkeletonBone shape="short" />
            </div>
          ))}
        </SkelterSurface>
      </section>
      <div className="member-profile-side">
        <section className="panel">
          <div className="panel-h">
            <h2>Active projects</h2>
          </div>
          <SkelterSurface label="Loading member projects…">
            <div className="panel-b stack">
              {SIDE_ROWS.map((key) => (
                <SkeletonBone key={key} />
              ))}
            </div>
          </SkelterSurface>
        </section>
        <section className="panel">
          <div className="panel-h">
            <h2>Recent activity</h2>
          </div>
          <SkelterSurface label="Loading member activity…">
            <div className="panel-b stack">
              {SIDE_ROWS.map((key) => (
                <SkeletonBone key={key} />
              ))}
            </div>
          </SkelterSurface>
        </section>
      </div>
    </div>
  </div>
);

export { MemberDetail, MemberDetailSkeleton };
