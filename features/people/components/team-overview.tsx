/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-inline-styles */
/* eslint-disable shadcn/no-restyle */

import {
  ArrowRight,
  Briefcase,
  CheckCircle,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/workspace/empty-state";
import { EmployeeCreateForm } from "@/features/people/components/people-admin-forms";
import { TeamAdminControls } from "@/features/people/components/team-admin-controls";
import type { TeamSummary } from "@/src/server/people/team-management";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { ProjectListItem } from "@/src/server/projects/project-contracts";
import type { ProjectTaskListItem } from "@/src/server/work/work-contracts";

type TeamTask = Pick<
  ProjectTaskListItem,
  "assignees" | "id" | "projectId" | "projectTaskNumber" | "status" | "title"
> & {
  readonly projectKey: string;
  readonly projectName: string;
};

const taskStatusLabel: Record<ProjectTaskListItem["status"], string> = {
  backlog: "Backlog",
  done: "Done",
  progress: "In Progress",
  review: "Review",
  todo: "To Do",
};

const TeamOverview = ({
  canManage,
  members,
  projects,
  tasks,
  team,
  teams,
}: {
  readonly canManage: boolean;
  readonly members: readonly EmployeeDirectoryEntry[];
  readonly projects: readonly ProjectListItem[];
  readonly tasks: readonly TeamTask[];
  readonly team: TeamSummary;
  readonly teams: readonly { readonly id: string; readonly name: string }[];
}) => {
  const openTasks = tasks.filter((task) => task.status !== "done");

  return (
    <div className="team-overview">
      <header className="ph team-overview-heading">
        <div>
          <div className="team-overview-title">
            <span
              aria-hidden="true"
              className="team-color-mark"
              style={{ backgroundColor: team.color }}
            />
            <h1>{team.name}</h1>
          </div>
          <p>{team.description || "Projects and people in this team."}</p>
        </div>
        {canManage ? (
          <div className="team-overview-actions">
            <TeamAdminControls team={team} triggerLabel="Edit team" />
            <EmployeeCreateForm
              defaultTeamId={team.id}
              teams={teams}
              triggerLabel="Add team member"
            />
          </div>
        ) : null}
      </header>

      <div className="team-overview-grid">
        <section aria-labelledby="team-projects-heading" className="panel">
          <div className="panel-h team-overview-section-heading">
            <div className="team-section-title">
              <Briefcase aria-hidden="true" size={18} />
              <h2 id="team-projects-heading">Projects</h2>
            </div>
            <span className="ct">{projects.length}</span>
          </div>
          {projects.length ? (
            <div className="team-project-list">
              {projects.map((project) => (
                <Link
                  className="team-project-row"
                  href={`/projects/${project.id}?view=overview`}
                  key={project.id}
                >
                  <span
                    aria-hidden="true"
                    className="team-project-mark"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="team-project-main">
                    <span className="team-project-title">
                      <strong>{project.name}</strong>
                      <span className="team-project-status">
                        {project.status}
                      </span>
                    </span>
                    <Progress
                      aria-label={`${project.name} progress`}
                      className="team-project-progress"
                      value={project.progress}
                    />
                  </span>
                  <span className="team-project-percent">
                    {project.progress}%
                    <ArrowRight aria-hidden="true" size={15} />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="panel-b muted">
              No projects are assigned to this team.
            </div>
          )}
        </section>

        <section aria-labelledby="team-open-tasks-heading" className="panel">
          <div className="panel-h team-overview-section-heading">
            <div className="team-section-title">
              <CheckCircle aria-hidden="true" size={18} />
              <h2 id="team-open-tasks-heading">Open tasks</h2>
            </div>
            <span className="ct">{openTasks.length}</span>
          </div>
          {openTasks.length ? (
            <div className="team-open-task-list">
              {openTasks.map((task) => (
                <Link
                  className="team-open-task-row"
                  href={`/projects/${task.projectId}?view=board`}
                  key={task.id}
                >
                  <span
                    className="team-task-status"
                    data-task-status={task.status}
                  >
                    {taskStatusLabel[task.status]}
                  </span>
                  <span className="team-task-main">
                    <strong>{task.title}</strong>
                    <span>
                      {task.projectKey}-{task.projectTaskNumber} ·{" "}
                      {task.projectName}
                    </span>
                  </span>
                  <span className="team-task-assignees">
                    {task.assignees.length
                      ? task.assignees.map(({ name }) => name).join(", ")
                      : "Unassigned"}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Open tasks assigned to this team's members show here."
              icon={CheckCircle}
              size="compact"
              title="No open tasks"
            />
          )}
        </section>

        <section aria-labelledby="team-members-heading" className="panel">
          <div className="panel-h team-overview-section-heading">
            <div className="team-section-title">
              <UsersThree aria-hidden="true" size={18} />
              <h2 id="team-members-heading">Members</h2>
            </div>
            <span className="ct">{members.length}</span>
          </div>
          {members.length ? (
            <div className="team-member-list">
              {members.map((member) => (
                <article className="team-member-row" key={member.id}>
                  <span aria-hidden="true" className="av">
                    {member.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="team-member-main">
                    <strong>{member.name}</strong>
                    <span>{member.jobTitle || member.email}</span>
                  </span>
                  <span className="ct">
                    {member.role === "admin" ? "Admin" : "Employee"}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Add people to this team from Members."
              icon={UsersThree}
              size="compact"
              title="No members yet"
            />
          )}
          <div className="panel-b team-member-footer">
            <Link className="team-members-link" href="/members">
              View all members <ArrowRight aria-hidden="true" size={15} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export { TeamOverview };
export type { TeamTask };
