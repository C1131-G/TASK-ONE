/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles, shadcn/no-restyle */

import {
  CalendarCheck,
  FolderOpen,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/workspace/empty-state";
import { getDashboardOverview } from "@/features/dashboard/dashboard-queries";
import {
  milestoneDateFormatter,
  projectStatusLabels,
  taskStatuses,
} from "@/features/dashboard/overview-labels";
import { ProjectCreateForm } from "@/features/projects/components/project-create-form";
import { ProjectIcon } from "@/features/projects/components/project-icon";
import { listProjects } from "@/features/projects/projects-queries";
import { getPageSession } from "@/src/server/auth/page-session";

const WorkspaceOverview = async () => {
  const [dashboard, projects, session] = await Promise.all([
    getDashboardOverview({}),
    listProjects({}),
    getPageSession(),
  ]);
  const isAdmin =
    session.kind === "authenticated" && session.user.role === "admin";
  if (!dashboard.ok || !projects.ok) {
    throw new Error("Workspace overview could not be loaded.");
  }

  const taskCount = Object.values(dashboard.data.tasks).reduce(
    (sum, count) => sum + count,
    0
  );
  const doneCount = dashboard.data.tasks.done;
  const openTaskCount = taskCount - doneCount;
  const activeProjectCount = projects.data.filter(
    (project) => project.status !== "complete"
  ).length;
  const completedProjectCount = projects.data.filter(
    (project) => project.status === "complete"
  ).length;
  const employees = dashboard.data.workload.toSorted(
    (left, right) => right.openTaskCount - left.openTaskCount
  );
  const employeesById = new Map(
    dashboard.data.workload.map((employee) => [
      employee.employeeId,
      employee.employeeName,
    ])
  );
  const employeesWithTasks = employees
    .filter((employee) => employee.openTaskCount > 0)
    .slice(0, 7);

  return (
    <>
      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat">
          <span className="k">Projects</span>
          <span className="v">{activeProjectCount}</span>
          <span className="d">{completedProjectCount} completed</span>
        </div>
        <div className="stat">
          <span className="k">Tasks</span>
          <span className="v">{taskCount}</span>
          <span className="d">{openTaskCount} open</span>
        </div>
        <div className="stat">
          <span className="k">Completion rate</span>
          <span className="v">
            {Math.round((doneCount / Math.max(taskCount, 1)) * 100)}%
          </span>
          <span className="d">Across all projects</span>
        </div>
        <div className="stat">
          <span className="k">Members</span>
          <span className="v">{dashboard.data.workload.length}</span>
          <span className="d">Active team members</span>
        </div>
      </div>
      <div className="grid2 overview-grid">
        <section aria-labelledby="overview-portfolio-heading" className="panel">
          <div className="panel-h">
            <h2 id="overview-portfolio-heading">Portfolio</h2>
            <Link className="btn btn-sm btn-ghost" href="/projects">
              All projects
            </Link>
          </div>
          {projects.data.length ? (
            <Table className="perm-t overview-project-table">
              <TableCaption className="sr-only">Project portfolio</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Open</TableHead>
                  <TableHead>Overdue</TableHead>
                  <TableHead>Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.data.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Link
                        aria-label={`Open ${project.name}`}
                        className="row"
                        href={`/projects/${project.id}`}
                      >
                        <ProjectIcon
                          color={project.color}
                          icon={project.icon}
                        />
                        <span>{project.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {project.leadId
                        ? (employeesById.get(project.leadId) ?? "Inactive lead")
                        : "Unassigned"}
                    </TableCell>
                    <TableCell>
                      <span className={`pstatus ${project.status}`}>
                        {projectStatusLabels[project.status]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="row">
                        <Progress
                          aria-label={`${project.progress}% complete`}
                          max={100}
                          value={project.progress}
                          workspace
                        />
                        <span className="num">{project.progress}%</span>
                      </span>
                    </TableCell>
                    <TableCell>{project.openTaskCount}</TableCell>
                    <TableCell>{project.overdueTaskCount}</TableCell>
                    <TableCell>{project.dueDate ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              action={
                isAdmin ? (
                  <ProjectCreateForm triggerLabel="Create project" />
                ) : null
              }
              description={
                isAdmin
                  ? "Create a project to start tracking its tasks and progress here."
                  : "Projects you can see appear here once an admin creates them."
              }
              icon={FolderOpen}
              title="No projects yet"
            />
          )}
        </section>
        <section aria-labelledby="overview-status-heading" className="panel">
          <div className="panel-h">
            <h2 id="overview-status-heading">Tasks by status</h2>
          </div>
          <div className="panel-b overview-status-list">
            {taskStatuses.map(([status, label]) => {
              const count = dashboard.data.tasks[status];
              const percentage = Math.round(
                (count / Math.max(taskCount, 1)) * 100
              );
              return (
                <Link
                  className="overview-status-row"
                  href={`/tasks?status=${status}&group=status`}
                  key={status}
                >
                  <span>{label}</span>
                  <Progress
                    aria-label={`${label}: ${count} tasks, ${percentage}%`}
                    data-task-status={status}
                    max={100}
                    value={percentage}
                    workspace
                  />
                  <span className="num">{count}</span>
                  <span className="muted">{percentage}%</span>
                </Link>
              );
            })}
          </div>
        </section>
        <section aria-labelledby="overview-workload-heading" className="panel">
          <div className="panel-h">
            <h2 id="overview-workload-heading">Workload</h2>
          </div>
          <div className="panel-b">
            <p className="muted overview-panel-caption">
              Open tasks per person
            </p>
            {employeesWithTasks.length ? (
              <div className="feed lined">
                {employeesWithTasks.map((employee) => (
                  <Link
                    className="row overview-workload-row"
                    href="/members"
                    key={employee.employeeId}
                  >
                    <span aria-hidden="true" className="av">
                      {employee.employeeName.slice(0, 1)}
                    </span>
                    <span className="trunc grow">{employee.employeeName}</span>
                    <span className="num">{employee.openTaskCount}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                description="Assign open tasks to see who is carrying the most work."
                icon={UsersThree}
                size="compact"
                title="No assigned open tasks"
              />
            )}
          </div>
        </section>
        <section
          aria-labelledby="overview-milestones-heading"
          className="panel"
        >
          <div className="panel-h">
            <h2 id="overview-milestones-heading">Upcoming milestones</h2>
          </div>
          {dashboard.data.upcomingMilestones.length ? (
            <div className="panel-b feed lined">
              {dashboard.data.upcomingMilestones.map((milestone) => (
                <Link
                  className="row overview-milestone-row"
                  href={`/projects/${milestone.projectId}?view=overview`}
                  key={milestone.id}
                >
                  <span className="trunc grow">{milestone.name}</span>
                  <span className="muted">{milestone.projectName}</span>
                  <time dateTime={milestone.dueDate}>
                    {milestoneDateFormatter.format(
                      new Date(`${milestone.dueDate}T00:00:00Z`)
                    )}
                  </time>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Milestones with a due date show here as they approach."
              icon={CalendarCheck}
              size="compact"
              title="No upcoming milestones"
            />
          )}
        </section>
      </div>
    </>
  );
};

const WorkspaceOverviewActions = async () => {
  const session = await getPageSession();
  const isAdmin =
    session.kind === "authenticated" && session.user.role === "admin";

  return (
    <div className="acts overview-actions">
      <Link className="btn btn-secondary btn-sm" href="/timeline">
        Timeline
      </Link>
      {isAdmin ? <ProjectCreateForm /> : null}
    </div>
  );
};

const WorkspaceOverviewActionsSkeleton = () => (
  <div aria-hidden="true" className="acts overview-actions">
    <span className="btn btn-secondary btn-sm opacity-0">Timeline</span>
  </div>
);

export {
  WorkspaceOverview,
  WorkspaceOverviewActions,
  WorkspaceOverviewActionsSkeleton,
};
