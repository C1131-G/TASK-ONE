/* eslint-disable shadcn/no-unknown-classes */

import Link from "next/link";
import type { ReactNode } from "react";

import type { ActivityEntry } from "@/src/server/activity/activity-management";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { ProjectListItem } from "@/src/server/projects/project-contracts";

const ProjectDetails = ({
  employees,
  project,
  teams,
}: {
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly project: ProjectListItem;
  readonly teams: readonly { readonly id: string; readonly name: string }[];
}) => {
  const lead = employees.find((employee) => employee.id === project.leadId);
  const team = teams.find(({ id }) => id === project.teamId);
  const memberIds = new Set(project.memberIds);
  const members = employees.filter((employee) => memberIds.has(employee.id));

  return (
    <section aria-labelledby="project-details-heading" className="panel">
      <div className="panel-h">
        <h2 id="project-details-heading">Details</h2>
      </div>
      <dl className="project-overview-details">
        <div>
          <dt>Status</dt>
          <dd>
            <span className={`pstatus ${project.status}`}>
              {project.status}
            </span>
          </dd>
        </div>
        <div>
          <dt>Lead</dt>
          <dd>{lead?.name ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt>Team</dt>
          <dd>
            {team ? (
              <Link href={`/teams/${team.id}`}>{team.name}</Link>
            ) : (
              "No team"
            )}
          </dd>
        </div>
        <div>
          <dt>Start</dt>
          <dd>{project.startDate ?? "Not set"}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{project.dueDate ?? "Not set"}</dd>
        </div>
        <div className="project-overview-members-row">
          <dt>Members</dt>
          <dd>
            {members.length > 0 ? (
              <ul
                aria-label="Project members"
                className="project-overview-members"
              >
                {members.map((member) => (
                  <li key={member.id}>
                    <span
                      aria-hidden="true"
                      className="project-overview-avatar"
                      title={member.name}
                    >
                      {member.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="sr-only">{member.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              "No members"
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
};

const ProjectRecentActivity = ({
  activity,
  unavailable,
  projectId,
}: {
  readonly activity: readonly ActivityEntry[];
  readonly unavailable: boolean;
  readonly projectId: string;
}) => {
  let activityContent: ReactNode;
  if (unavailable) {
    activityContent = (
      <p className="project-overview-empty" role="alert">
        Recent activity could not be loaded.
      </p>
    );
  } else if (activity.length === 0) {
    activityContent = (
      <p className="project-overview-empty">No project activity yet.</p>
    );
  } else {
    activityContent = (
      <ul className="project-overview-activity">
        {activity.slice(0, 6).map((entry) => (
          <li key={entry.id}>
            <span aria-hidden="true" className="project-overview-avatar">
              {entry.actorName.slice(0, 1).toUpperCase()}
            </span>
            <div className="project-overview-activity-copy">
              <p>
                <strong>{entry.actorName}</strong>{" "}
                {entry.action.replaceAll("_", " ")}
              </p>
              {entry.taskTitle ? (
                <span className="muted">{entry.taskTitle}</span>
              ) : null}
            </div>
            <time dateTime={entry.createdAt}>
              {entry.createdAt.slice(0, 10)}
            </time>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section
      aria-labelledby="project-recent-activity-heading"
      className="panel"
    >
      <div className="panel-h">
        <h2 id="project-recent-activity-heading">Recent activity</h2>
        <Link
          className="project-overview-text-link"
          href={`/projects/${projectId}?view=activity`}
        >
          View all
        </Link>
      </div>
      {activityContent}
    </section>
  );
};

export { ProjectDetails, ProjectRecentActivity };
