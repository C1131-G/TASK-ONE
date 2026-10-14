/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */

import Link from "next/link";

const HomeStats = ({
  activeProjects,
  atRisk,
  openTasks,
  assignedTasks,
  completed,
  overdue,
}: {
  readonly activeProjects: number;
  readonly atRisk: number;
  readonly openTasks: number;
  readonly assignedTasks: number;
  readonly completed: number;
  readonly overdue: number;
}) => (
  <div className="stats" style={{ marginBottom: 16 }}>
    <Link className="stat" href="/projects">
      <span className="k">Active projects</span>
      <span className="v">{activeProjects}</span>
      <span className="d">{atRisk} at risk</span>
    </Link>
    <Link className="stat" href="/tasks">
      <span className="k">Open tasks</span>
      <span className="v">{openTasks}</span>
      <span className="d">{assignedTasks} assigned to you</span>
    </Link>
    <Link className="stat" href="/tasks?status=done">
      <span className="k">Completed</span>
      <span className="v">{completed}</span>
      <span className="d">this week</span>
    </Link>
    <Link className="stat" href="/tasks?overdue=true">
      <span className="k">Overdue</span>
      <span
        className="v"
        style={overdue > 0 ? { color: "var(--red)" } : undefined}
      >
        {overdue}
      </span>
      <span className={`d${overdue > 0 ? " bad" : ""}`}>
        {overdue > 0 ? "need attention" : "all on track"}
      </span>
    </Link>
  </div>
);

export { HomeStats };
