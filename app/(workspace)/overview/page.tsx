/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { getDashboardOverviewAction } from "@/app/actions/dashboard";
import { listProjectsAction } from "@/app/actions/projects";
import { ProjectIcon } from "@/components/workspace/project-icon";

export const metadata: Metadata = { title: "Overview | Metsys" };

const OverviewPage = async () => {
  await connection();
  const [dashboard, projects] = await Promise.all([
    getDashboardOverviewAction({}),
    listProjectsAction({}),
  ]);
  if (!dashboard.ok || !projects.ok) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Workspace overview could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }

  const taskCount = Object.values(dashboard.data.tasks).reduce(
    (sum, count) => sum + count,
    0
  );
  const doneCount = dashboard.data.tasks.done;
  const employees = dashboard.data.workload.toSorted(
    (left, right) => right.openTaskCount - left.openTaskCount
  );
  return (
    <div className="page">
      <div className="ph">
        <div>
          <h1>Workspace overview</h1>
          <p>Health of every project in Metsys.</p>
        </div>
      </div>
      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat">
          <span className="k">Projects</span>
          <span className="v">{projects.data.length}</span>
          <span className="d">
            {dashboard.data.projects.complete} completed
          </span>
        </div>
        <div className="stat">
          <span className="k">Tasks</span>
          <span className="v">{taskCount}</span>
          <span className="d">{taskCount - doneCount} open</span>
        </div>
        <div className="stat">
          <span className="k">Completion rate</span>
          <span className="v">
            {Math.round((doneCount / Math.max(taskCount, 1)) * 100)}%
          </span>
          <span className="d">Across all projects</span>
        </div>
        <div className="stat">
          <span className="k">Overdue</span>
          <span className="v">{dashboard.data.overdueCount}</span>
          <span className="d">Open tasks past due</span>
        </div>
      </div>
      <div className="grid2">
        <section className="panel">
          <div className="panel-h">
            <h2>Portfolio</h2>
            <Link className="btn btn-sm btn-ghost" href={"/projects" as Route}>
              All projects
            </Link>
          </div>
          {projects.data.length ? (
            <div style={{ overflowX: "auto" }}>
              <table className="perm-t" style={{ minWidth: 580 }}>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 14 }}>Project</th>
                    <th style={{ textAlign: "left" }}>Status</th>
                    <th style={{ textAlign: "left" }}>Progress</th>
                    <th>Tasks</th>
                    <th style={{ textAlign: "left" }}>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.data.map((project) => (
                    <tr key={project.id}>
                      <td style={{ paddingLeft: 14 }}>
                        <Link
                          aria-label={`Open ${project.name}`}
                          className="row"
                          href={`/projects/${project.id}` as Route}
                        >
                          <ProjectIcon
                            color={project.color}
                            icon={project.icon}
                          />
                          <span>{project.name}</span>
                        </Link>
                      </td>
                      <td>{project.status}</td>
                      <td>
                        <span className="row">
                          <progress
                            aria-label={`${project.progress}% complete`}
                            className="prog"
                            max={100}
                            value={project.progress}
                          />
                          <span className="num">{project.progress}%</span>
                        </span>
                      </td>
                      <td>
                        {project.completedTaskCount}/{project.taskCount}
                      </td>
                      <td>{project.dueDate ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="panel-b muted">No projects yet.</div>
          )}
        </section>
        <section className="panel">
          <div className="panel-h">
            <h2>Team workload</h2>
          </div>
          {employees.length ? (
            <div className="panel-b feed lined">
              {employees.map((employee) => (
                <div className="row" key={employee.employeeId}>
                  <span aria-hidden="true" className="av">
                    {employee.employeeName.slice(0, 1)}
                  </span>
                  <span className="trunc grow">{employee.employeeName}</span>
                  <span className="num">{employee.openTaskCount}</span>
                  <span className="muted">open tasks</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="panel-b muted">No active employees.</div>
          )}
        </section>
      </div>
    </div>
  );
};

export default OverviewPage;
