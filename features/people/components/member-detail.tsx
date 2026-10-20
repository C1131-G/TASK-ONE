/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
import { listActivity } from "@/features/activity/activity-queries";
import {
  MemberProfileHeader,
  MemberProfileWork,
} from "@/features/people/components/member-profile";
import type { MemberTask } from "@/features/people/components/member-profile-task-rows";
import type { MemberTab } from "@/features/people/member-tab";
import {
  getEmployee,
  listAllEmployees,
  listTeams,
} from "@/features/people/people-queries";
import { listProjects } from "@/features/projects/projects-queries";
import { listAllProjectTasks } from "@/features/tasks/tasks-queries";
import { readOrThrow } from "@/lib/read-result";
import { getPageSession } from "@/src/server/auth/page-session";

const MemberHeader = async ({
  employeeId,
}: {
  readonly employeeId: string;
}) => {
  const [employee, projectsResult, teamsResult, session] = await Promise.all([
    getEmployee(employeeId),
    listProjects({}),
    listTeams({}),
    getPageSession(),
  ]);
  return (
    <MemberProfileHeader
      canManageMembers={
        session.kind === "authenticated" && session.user.role === "admin"
      }
      employee={employee}
      projects={projectsResult.ok ? projectsResult.data : []}
      teams={teamsResult.ok ? teamsResult.data : []}
    />
  );
};

const byDueDateThenTitle = (left: MemberTask, right: MemberTask) =>
  (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31") ||
  left.title.localeCompare(right.title);

const MemberWork = async ({
  employeeId,
  tab,
}: {
  readonly employeeId: string;
  readonly tab: MemberTab;
}) => {
  const [employee, employeesResult, projectsResult, session] =
    await Promise.all([
      getEmployee(employeeId),
      listAllEmployees(),
      listProjects({}),
      getPageSession(),
    ]);
  const projects = readOrThrow(projectsResult, "Member projects");
  const [activityResult, projectTaskResults] = await Promise.all([
    listActivity({ actorId: employee.id, limit: 8 }),
    Promise.all(projects.map(({ id }) => listAllProjectTasks(id))),
  ]);
  if (projectTaskResults.some((tasks) => tasks === undefined)) {
    throw new Error("Member work could not be loaded.");
  }

  const projectsById = new Map(
    projects.map((project) => [project.id, project])
  );
  const memberTasks: MemberTask[] = projectTaskResults.flatMap((tasks) =>
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
    .toSorted(byDueDateThenTitle);
  const completedTasks = memberTasks
    .filter(({ status }) => status === "done")
    .toSorted((left, right) =>
      (right.completedAt ?? "").localeCompare(left.completedAt ?? "")
    );
  const employees = employeesResult.ok ? employeesResult.data : [];

  return (
    <MemberProfileWork
      activities={activityResult.ok ? activityResult.data : []}
      completedTasks={completedTasks}
      employee={employee}
      employees={employees.map(({ id, name }) => ({ id, name }))}
      isAdmin={
        session.kind === "authenticated" && session.user.role === "admin"
      }
      openTasks={openTasks}
      projects={projects}
      tab={tab}
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

// Mirrors MemberProfileHeader: the person is data.
const MemberHeaderSkeleton = () => (
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
);

// Mirrors MemberProfileWork: stat labels and panel titles are static; the
// counts and rows are data.
const MemberWorkSkeleton = () => (
  <>
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
          <span aria-current="page">Assigned</span>
          <span>Completed</span>
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
  </>
);

export { MemberHeader, MemberHeaderSkeleton, MemberWork, MemberWorkSkeleton };
