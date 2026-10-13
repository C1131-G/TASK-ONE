/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles, shadcn/no-restyle */

import { formatDistanceToNowStrict } from "date-fns";
import type { Route } from "next";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FavoriteToggle } from "@/components/workspace/favorite-toggle";
import { ProjectIcon } from "@/features/projects/components/project-icon";
import { ProjectListActions } from "@/features/projects/components/project-list-actions";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { ProjectListItem } from "@/src/server/projects/project-contracts";

const statusLabel: Record<ProjectListItem["status"], string> = {
  active: "In Progress",
  complete: "Completed",
  hold: "On Hold",
  planning: "Planning",
  risk: "At Risk",
};

interface ProjectLayoutProps {
  readonly projects: readonly ProjectListItem[];
  readonly favorites: ReadonlySet<string>;
  readonly membersById: ReadonlyMap<string, EmployeeDirectoryEntry>;
  readonly isAdmin: boolean;
}

const initials = (name: string) =>
  name
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

export const ProjectMemberAvatars = ({
  memberIds,
  membersById,
}: {
  readonly memberIds: readonly string[];
  readonly membersById: ReadonlyMap<string, EmployeeDirectoryEntry>;
}) => (
  <ul aria-label="Project members" className="project-members">
    {memberIds.slice(0, 3).map((memberId) => {
      const member = membersById.get(memberId);
      return member ? (
        <li key={member.id}>
          <Avatar className="project-member-avatar">
            <AvatarImage alt={member.name} src={member.avatar ?? undefined} />
            <AvatarFallback>{initials(member.name)}</AvatarFallback>
          </Avatar>
        </li>
      ) : null;
    })}
    {memberIds.length > 3 ? (
      <li aria-label={`${memberIds.length - 3} more project members`}>
        <span className="project-member-overflow">+{memberIds.length - 3}</span>
      </li>
    ) : null}
  </ul>
);

const ProjectCard = ({
  project,
  favorites,
  membersById,
  isAdmin,
}: {
  readonly project: ProjectListItem;
  readonly favorites: ReadonlySet<string>;
  readonly membersById: ReadonlyMap<string, EmployeeDirectoryEntry>;
  readonly isAdmin: boolean;
}) => (
  <article className="pcard">
    <Link className="pcard-link" href={`/projects/${project.id}` as Route}>
      <div className="row">
        <ProjectIcon color={project.color} icon={project.icon} />
        <strong className="trunc grow">{project.name}</strong>
        <span className={`pstatus ${project.status}`}>
          {statusLabel[project.status]}
        </span>
      </div>
      <p className="desc">{project.description || "No description"}</p>
      <div className="row">
        <span aria-label={`${project.progress}% complete`} className="prog">
          <span style={{ width: `${project.progress}%` }} />
        </span>
        <span className="num">{project.progress}%</span>
      </div>
      <div className="foot">
        <span>
          {project.completedTaskCount} of {project.taskCount} tasks
        </span>
        <span className="sp" />
        <span>{project.dueDate ?? "No due date"}</span>
        <time dateTime={project.updatedAt} title="Last updated">
          {formatDistanceToNowStrict(new Date(project.updatedAt), {
            addSuffix: true,
          })}
        </time>
      </div>
      <ProjectMemberAvatars
        memberIds={project.memberIds}
        membersById={membersById}
      />
    </Link>
    <FavoriteToggle
      id={project.id}
      initialFavorite={favorites.has(project.id)}
      kind="project"
    />
    {isAdmin ? <ProjectListActions project={project} /> : null}
  </article>
);

export const ProjectGridView = (props: ProjectLayoutProps) => (
  <div className="pgrid">
    {props.projects.map((project) => (
      <ProjectCard key={project.id} project={project} {...props} />
    ))}
  </div>
);

export const ProjectListView = ({
  projects,
  favorites,
  membersById,
  isAdmin,
}: ProjectLayoutProps) => (
  <section aria-label="Project list" className="project-list-view">
    {projects.map((project) => (
      <article className="project-list-row" key={project.id}>
        <Link
          aria-label={`Open ${project.name}`}
          className="project-list-main"
          href={`/projects/${project.id}` as Route}
        >
          <ProjectIcon color={project.color} icon={project.icon} />
          <span className="project-list-title">
            <strong>{project.name}</strong>
            <span className="muted trunc">
              {project.description || "No description"}
            </span>
          </span>
          <Badge data-project-status={project.status} variant="outline">
            {statusLabel[project.status]}
          </Badge>
          <span className="project-list-progress">
            <span className="prog">
              <span style={{ width: `${project.progress}%` }} />
            </span>
            <span className="num">{project.progress}%</span>
          </span>
          <span className="muted">{project.dueDate ?? "No due date"}</span>
          <span className="muted" title="Last updated">
            {formatDistanceToNowStrict(new Date(project.updatedAt), {
              addSuffix: true,
            })}
          </span>
          <ProjectMemberAvatars
            memberIds={project.memberIds}
            membersById={membersById}
          />
        </Link>
        <FavoriteToggle
          id={project.id}
          initialFavorite={favorites.has(project.id)}
          kind="project"
        />
        {isAdmin ? <ProjectListActions project={project} /> : null}
      </article>
    ))}
  </section>
);

export const ProjectTableView = ({
  projects,
  favorites,
  membersById,
  isAdmin,
}: ProjectLayoutProps) => (
  <Table className="project-table">
    <TableCaption className="sr-only">Projects</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>Project</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Progress</TableHead>
        <TableHead>Tasks</TableHead>
        <TableHead>Due date</TableHead>
        <TableHead>Updated</TableHead>
        <TableHead>Members</TableHead>
        <TableHead>Favorite</TableHead>
        {isAdmin ? <TableHead>Actions</TableHead> : null}
      </TableRow>
    </TableHeader>
    <TableBody>
      {projects.map((project) => (
        <TableRow key={project.id}>
          <TableCell>
            <Link
              className="project-table-name"
              href={`/projects/${project.id}` as Route}
            >
              <ProjectIcon color={project.color} icon={project.icon} />
              <span>{project.name}</span>
            </Link>
          </TableCell>
          <TableCell>
            <Badge data-project-status={project.status} variant="outline">
              {statusLabel[project.status]}
            </Badge>
          </TableCell>
          <TableCell>
            <span className="project-list-progress">
              <span className="prog">
                <span style={{ width: `${project.progress}%` }} />
              </span>
              <span className="num">{project.progress}%</span>
            </span>
          </TableCell>
          <TableCell>
            {project.completedTaskCount}/{project.taskCount}
          </TableCell>
          <TableCell>{project.dueDate ?? "No due date"}</TableCell>
          <TableCell>
            {formatDistanceToNowStrict(new Date(project.updatedAt), {
              addSuffix: true,
            })}
          </TableCell>
          <TableCell>
            <ProjectMemberAvatars
              memberIds={project.memberIds}
              membersById={membersById}
            />
          </TableCell>
          <TableCell>
            <FavoriteToggle
              id={project.id}
              initialFavorite={favorites.has(project.id)}
              kind="project"
            />
          </TableCell>
          {isAdmin ? (
            <TableCell>
              <ProjectListActions project={project} />
            </TableCell>
          ) : null}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
