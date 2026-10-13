/* eslint-disable shadcn/no-unknown-classes */

import type { ReactNode } from "react";

import {
  ProjectProgress,
  ProjectUpcomingTasks,
} from "@/features/projects/components/project-overview-main-sections";
import {
  ProjectDetails,
  ProjectRecentActivity,
} from "@/features/projects/components/project-overview-side-sections";
import type { ProjectOverviewTask } from "@/features/projects/types/project-overview-contracts";
import type { ActivityEntry } from "@/src/server/activity/activity-management";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { ProjectListItem } from "@/src/server/projects/project-contracts";

const ProjectOverview = ({
  activity,
  activityUnavailable,
  currentUserId,
  employees,
  isAdmin,
  milestones,
  project,
  tasks,
  teams,
  today,
}: {
  readonly activity: readonly ActivityEntry[];
  readonly activityUnavailable: boolean;
  readonly currentUserId: string | null;
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly isAdmin: boolean;
  readonly milestones: ReactNode;
  readonly project: ProjectListItem;
  readonly tasks: readonly ProjectOverviewTask[];
  readonly teams: readonly { readonly id: string; readonly name: string }[];
  readonly today: string;
}) => (
  <div className="project-overview">
    <div className="project-overview-main">
      <section aria-labelledby="project-about-heading" className="panel">
        <div className="panel-h">
          <h2 id="project-about-heading">About</h2>
        </div>
        <p className="project-overview-about">
          {project.description || "No project description has been added."}
        </p>
      </section>
      <ProjectProgress project={project} tasks={tasks} today={today} />
      <ProjectUpcomingTasks
        currentUserId={currentUserId}
        employees={employees}
        isAdmin={isAdmin}
        project={project}
        tasks={tasks}
        today={today}
      />
    </div>
    <aside
      aria-label="Project details and updates"
      className="project-overview-aside"
    >
      <ProjectDetails employees={employees} project={project} teams={teams} />
      {milestones}
      <ProjectRecentActivity
        activity={activity}
        projectId={project.id}
        unavailable={activityUnavailable}
      />
    </aside>
  </div>
);

export { ProjectOverview };
