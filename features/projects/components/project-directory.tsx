/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles, shadcn/no-restyle -- Workspace classes are defined in app/workspace-styles. */

import Link from "next/link";
import { connection } from "next/server";

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import { getPersonalWorkspace } from "@/features/discovery/discovery-queries";
import { listAllEmployees } from "@/features/people/people-queries";
import { ProjectCreateForm } from "@/features/projects/components/project-create-form";
import {
  ProjectGridView,
  ProjectListView,
  ProjectTableView,
} from "@/features/projects/components/project-list-layouts";
import {
  projectHref,
  projectStatuses,
  projectViews,
  statusLabel,
} from "@/features/projects/project-filters";
import type { ProjectFilters } from "@/features/projects/project-filters";
import { listProjects } from "@/features/projects/projects-queries";
import { getPageSession } from "@/src/server/auth/page-session";

const ProjectDirectory = async ({
  filters,
}: {
  readonly filters: ProjectFilters;
}) => {
  await connection();
  const [result, session, personal, employeeResult] = await Promise.all([
    listProjects({}),
    getPageSession(),
    getPersonalWorkspace({}),
    listAllEmployees(),
  ]);
  if (!result.ok) {
    return (
      <div className="panel panel-b" role="alert">
        Projects could not be loaded. Refresh to retry.
      </div>
    );
  }
  const favoriteProjectIds = new Set(
    personal.ok ? personal.data.projects.map((project) => project.id) : []
  );
  const { query, sort, status: selectedStatus, view } = filters;
  const filterValues = { q: query, sort, status: selectedStatus };
  const projects = result.data
    .filter((project) => {
      const matchesQuery =
        `${project.name} ${project.key} ${project.description ?? ""}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase());
      return (
        matchesQuery && (!selectedStatus || project.status === selectedStatus)
      );
    })
    .toSorted((left, right) => {
      if (sort === "recent") {
        return right.updatedAt.localeCompare(left.updatedAt);
      }
      if (sort === "due") {
        return (left.dueDate ?? "9999-12-31").localeCompare(
          right.dueDate ?? "9999-12-31"
        );
      }
      if (sort === "progress") {
        return right.progress - left.progress;
      }
      return left.name.localeCompare(right.name);
    });
  const employees = employeeResult.ok ? employeeResult.data : [];
  const membersById = new Map(
    employees.map((employee) => [employee.id, employee])
  );
  const isAdmin =
    session.kind === "authenticated" && session.user.role === "admin";
  const allActiveCount = result.data.filter(
    (project) => project.status !== "complete"
  ).length;
  const completedCount = result.data.length - allActiveCount;

  return (
    <>
      <div className="ph">
        <div>
          <h1>Projects</h1>
          <p>
            {allActiveCount} active · {completedCount} completed
          </p>
        </div>
        {isAdmin ? (
          <div className="acts">
            <ProjectCreateForm />
          </div>
        ) : null}
      </div>
      <form className="toolbar project-toolbar" method="get">
        <label className="field project-search" htmlFor="projects-search">
          <span className="sr-only">Search projects</span>
          <WorkspaceInput
            autoComplete="off"
            className="input"
            defaultValue={query}
            id="projects-search"
            maxLength={120}
            name="q"
            placeholder="Search projects"
            type="search"
          />
        </label>
        <label className="field" htmlFor="projects-status">
          <span className="sr-only">Filter by status</span>
          <WorkspaceSelect
            ariaLabel="Filter by status"
            className="input"
            defaultValue={selectedStatus}
            id="projects-status"
            name="status"
          >
            <WorkspaceSelectItem value="">All statuses</WorkspaceSelectItem>
            {projectStatuses.map((status) => (
              <WorkspaceSelectItem key={status} value={status}>
                {statusLabel[status]}
              </WorkspaceSelectItem>
            ))}
          </WorkspaceSelect>
        </label>
        <label className="field" htmlFor="projects-sort">
          <span className="sr-only">Sort projects</span>
          <WorkspaceSelect
            ariaLabel="Sort projects"
            className="input"
            defaultValue={sort}
            id="projects-sort"
            name="sort"
          >
            <WorkspaceSelectItem value="recent">
              Recently active
            </WorkspaceSelectItem>
            <WorkspaceSelectItem value="name">Name</WorkspaceSelectItem>
            <WorkspaceSelectItem value="due">Due date</WorkspaceSelectItem>
            <WorkspaceSelectItem value="progress">Progress</WorkspaceSelectItem>
          </WorkspaceSelect>
        </label>
        <input name="view" type="hidden" value={view} />
        <WorkspaceButton className="btn btn-sm btn-secondary" type="submit">
          Apply
        </WorkspaceButton>
      </form>
      <nav aria-label="Project layout" className="tabs project-view-tabs">
        {projectViews.map((layout) => (
          <Link
            aria-current={view === layout ? "page" : undefined}
            className={`tab${view === layout ? " on" : ""}`}
            href={projectHref(filterValues, layout)}
            key={layout}
          >
            {layout[0]?.toUpperCase()}
            {layout.slice(1)}
          </Link>
        ))}
      </nav>
      {projects.length > 0 && view === "grid" ? (
        <ProjectGridView
          favorites={favoriteProjectIds}
          isAdmin={isAdmin}
          membersById={membersById}
          projects={projects}
        />
      ) : null}
      {projects.length > 0 && view === "list" ? (
        <ProjectListView
          favorites={favoriteProjectIds}
          isAdmin={isAdmin}
          membersById={membersById}
          projects={projects}
        />
      ) : null}
      {projects.length > 0 && view === "table" ? (
        <ProjectTableView
          favorites={favoriteProjectIds}
          isAdmin={isAdmin}
          membersById={membersById}
          projects={projects}
        />
      ) : null}
      {projects.length === 0 ? (
        <section className="panel panel-b">
          <h2>
            {result.data.length ? "No matching projects" : "No projects yet"}
          </h2>
          <p className="muted">
            {result.data.length
              ? "Try changing your search or filters."
              : "An administrator can create the first project."}
          </p>
          {result.data.length > 0 ? (
            <WorkspaceButton asChild className="btn btn-secondary btn-sm">
              <Link href="/projects">Clear filters</Link>
            </WorkspaceButton>
          ) : null}
        </section>
      ) : null}
    </>
  );
};

// The header shows live counts, so the skeleton repeats its static title.
const ProjectDirectorySkeleton = () => (
  <>
    <div className="ph">
      <div>
        <h1>Projects</h1>
        <p className="muted">Loading projects…</p>
      </div>
    </div>
    <PanelSkeleton label="Loading projects…" rows={6} />
  </>
);

export { ProjectDirectory, ProjectDirectorySkeleton };
