/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

import {
  ArrowLeft,
  CalendarBlank,
  EnvelopeSimple,
} from "@phosphor-icons/react/dist/ssr";
import type { Route } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmployeeAdminControls } from "@/components/workspace/employee-admin-controls";
import { MemberProfileCopyEmail } from "@/components/workspace/member-profile-copy-email";
import { MemberProfileTaskDetails } from "@/components/workspace/member-profile-task-details";
import { QuickTaskForm } from "@/components/workspace/quick-task-form";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  formatActivityTime,
  getActivityVerb,
} from "@/src/lib/activity-display";
import { getUtcToday } from "@/src/lib/utc-today";
import type { ActivityEntry } from "@/src/server/activity/activity-management";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { ProjectListItem } from "@/src/server/projects/project-contracts";
import type { ProjectTaskListItemSchema } from "@/src/server/work/work-contracts";

type ProjectTask = typeof ProjectTaskListItemSchema.Type;

type MemberTask = ProjectTask & {
  readonly projectKey: string;
  readonly projectName: string;
};

const formatTaskStatus = (status: MemberTask["status"]): string => {
  switch (status) {
    case "backlog": {
      return "Backlog";
    }
    case "done": {
      return "Done";
    }
    case "progress": {
      return "In Progress";
    }
    case "review": {
      return "Review";
    }
    case "todo": {
      return "To Do";
    }
    default: {
      return status;
    }
  }
};

const MemberTaskRows = ({
  employees,
  isAdmin,
  viewerId,
  tasks,
}: {
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly isAdmin: boolean;
  readonly viewerId: string | null;
  readonly tasks: readonly MemberTask[];
}) =>
  tasks.length ? (
    <ul className="member-profile-task-list">
      {tasks.map((task) => (
        <li className="member-profile-task" key={task.id}>
          <span
            aria-hidden="true"
            className={`project-status-dot ${task.status}`}
          />
          <div className="member-profile-task-copy">
            <MemberProfileTaskDetails
              employees={employees}
              isAdmin={isAdmin}
              task={task}
              viewerId={viewerId}
            />
            <span>
              {task.projectKey}-{task.projectTaskNumber} · {task.projectName}
            </span>
          </div>
          <span className="member-profile-task-meta">
            {task.dueDate ? (
              <time dateTime={task.dueDate}>
                <CalendarBlank aria-hidden="true" size={14} />
                {task.dueDate}
              </time>
            ) : null}
            <Badge variant="outline">{formatTaskStatus(task.status)}</Badge>
          </span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="panel-b faint member-profile-empty">No tasks here</p>
  );

const MemberProfile = ({
  activities,
  canManageMembers,
  employee,
  employees,
  openTasks,
  completedTasks,
  projects,
  teams,
  tab,
  viewerId,
  isAdmin,
}: {
  readonly activities: readonly ActivityEntry[];
  readonly canManageMembers: boolean;
  readonly employee: EmployeeDirectoryEntry;
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly isAdmin: boolean;
  readonly openTasks: readonly MemberTask[];
  readonly completedTasks: readonly MemberTask[];
  readonly projects: readonly ProjectListItem[];
  readonly teams: readonly { readonly id: string; readonly name: string }[];
  readonly tab: "assigned" | "completed";
  readonly viewerId: string | null;
}) => {
  const today = getUtcToday();
  const activeProjects = projects.filter(
    (project) =>
      project.memberIds.includes(employee.id) &&
      project.status !== "complete" &&
      project.archivedAt === null
  );
  const overdueCount = openTasks.filter(
    (task) => task.dueDate !== null && task.dueDate < today
  ).length;
  const visibleTasks = tab === "assigned" ? openTasks : completedTasks;

  return (
    <div className="page member-profile-page">
      <Link className="member-profile-back" href="/members">
        <ArrowLeft aria-hidden="true" size={15} />
        All members
      </Link>
      <header className="member-profile-header">
        <Avatar className="member-profile-avatar">
          {employee.avatar ? (
            <AvatarImage alt="" src={employee.avatar} />
          ) : null}
          <AvatarFallback>
            {employee.name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="member-profile-identity">
          <div className="member-profile-name-row">
            <h1>{employee.name}</h1>
            <Badge variant="secondary">
              {employee.role === "admin" ? "Admin" : "Employee"}
            </Badge>
          </div>
          <p className="member-profile-job">
            {employee.jobTitle ?? "No job title"}
            {employee.teamName ? ` · ${employee.teamName}` : " · No team"}
          </p>
          <a className="member-profile-email" href={`mailto:${employee.email}`}>
            <EnvelopeSimple aria-hidden="true" size={15} />
            {employee.email}
          </a>
        </div>
        <div className="member-profile-actions">
          <MemberProfileCopyEmail email={employee.email} />
          {projects.length ? (
            <QuickTaskForm
              defaultAssigneeIds={[employee.id]}
              description={`This task will be assigned to ${employee.name}.`}
              projects={projects.map(({ id, name }) => ({ id, name }))}
              trigger={
                <WorkspaceButton className="btn btn-primary" type="button">
                  Assign task
                </WorkspaceButton>
              }
            />
          ) : null}
          {canManageMembers ? (
            <EmployeeAdminControls employee={employee} teams={teams} />
          ) : null}
        </div>
      </header>

      <section
        aria-label="Member work summary"
        className="stats member-profile-stats"
      >
        <div className="stat">
          <span className="k">Active projects</span>
          <span className="v">{activeProjects.length}</span>
        </div>
        <div className="stat">
          <span className="k">Assigned tasks</span>
          <span className="v">{openTasks.length}</span>
        </div>
        <div className="stat">
          <span className="k">Completed tasks</span>
          <span className="v">{completedTasks.length}</span>
        </div>
        <div className="stat">
          <span className="k">Overdue</span>
          <span className={`v${overdueCount ? " is-overdue" : ""}`}>
            {overdueCount}
          </span>
        </div>
      </section>

      <div className="member-profile-grid">
        <section aria-label="Assigned tasks" className="panel">
          <nav aria-label="Member task filters" className="member-profile-tabs">
            <Link
              aria-current={tab === "assigned" ? "page" : undefined}
              href={`/members/${employee.id}?tab=assigned` as Route}
            >
              Assigned · {openTasks.length}
            </Link>
            <Link
              aria-current={tab === "completed" ? "page" : undefined}
              href={`/members/${employee.id}?tab=completed` as Route}
            >
              Completed · {completedTasks.length}
            </Link>
          </nav>
          <MemberTaskRows
            employees={employees}
            isAdmin={isAdmin}
            tasks={visibleTasks}
            viewerId={viewerId}
          />
        </section>

        <div className="member-profile-side">
          <section aria-labelledby="member-projects-title" className="panel">
            <div className="panel-h">
              <h2 id="member-projects-title">Active projects</h2>
              <span className="faint">{activeProjects.length}</span>
            </div>
            {activeProjects.length ? (
              <ul className="member-profile-project-list">
                {activeProjects.map((project) => (
                  <li key={project.id}>
                    <Link href={`/projects/${project.id}`}>
                      <span
                        aria-hidden="true"
                        className="member-profile-project-color"
                        style={
                          {
                            "--project-color": project.color,
                          } as CSSProperties
                        }
                      />
                      <span>{project.name}</span>
                      <span className="faint">
                        {project.leadId === employee.id ? "Lead" : "Member"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-b faint">No active projects</p>
            )}
          </section>

          <section aria-labelledby="member-activity-title" className="panel">
            <div className="panel-h">
              <h2 id="member-activity-title">Recent activity</h2>
            </div>
            {activities.length ? (
              <ul className="member-profile-activity-list">
                {activities.map((activity) => (
                  <li key={activity.id}>
                    <span
                      aria-hidden="true"
                      className="member-profile-activity-dot"
                    />
                    <div>
                      <p>
                        {getActivityVerb(activity.action)}{" "}
                        <strong>
                          {activity.taskTitle ??
                            activity.projectName ??
                            "workspace"}
                        </strong>
                      </p>
                      <time dateTime={activity.createdAt}>
                        {formatActivityTime(activity.createdAt)}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-b faint">No recent activity</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export { MemberProfile };
