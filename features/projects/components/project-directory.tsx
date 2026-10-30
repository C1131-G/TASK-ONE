/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles, shadcn/no-restyle -- Workspace classes are defined in apps/web/app/workspace-styles. */

import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { TabUnderline } from "@/components/ui/tab-underline";
import { ViewSwitchTransition } from "@/components/ui/view-switch-transition";
import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
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
import { listAllProjects } from "@/features/projects/projects-queries";
import { readOrThrow } from "@/lib/read-result";
import { getPageSession } from "@/src/server/auth/page-session";

const ProjectDirectory = async ({
  filters,
}: {
  readonly filters: ProjectFilters;
}) => {
  const [result, session, personal, employeeResult] = await Promise.all([
    listAllProjects(),
    getPageSession(),
    getPersonalWorkspace({}),
    listAllEmployees(),
  ]);
  if (!result.ok) {
    throw new Error("Projects could not be loaded.");
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
  return (
    <>
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
            {view === layout ? (
              <TabUnderline name="project-layout-tab" />
            ) : null}
          </Link>
        ))}
      </nav>
      <ViewSwitchTransition name="project-layout" view={view}>
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
      </ViewSwitchTransition>
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

const ProjectCounts = async () => {
  const projects = readOrThrow(await listAllProjects(), "Projects");
  const activeCount = projects.filter(
    (project) => project.status !== "complete"
  ).length;
  return `${activeCount} active · ${projects.length - activeCount} completed`;
};

// Only admins create projects; others see no action, so there is no space to
// hold.
const ProjectDirectoryActions = async () => {
  const session = await getPageSession();
  if (session.kind !== "authenticated" || session.user.role !== "admin") {
    return null;
  }
  return (
    <div className="acts">
      <ProjectCreateForm />
    </div>
  );
};

const PROJECT_CARDS = SKELETON_KEYS.slice(0, 3);

const VIEWS = ["Grid", "List", "Table"] as const;

const ProjectCardSkeleton = () => (
  <article className="pcard">
    <div className="pcard-link">
      <div className="row">
        <SkeletonBone shape="avatar" />
        <strong className="grow">
          <SkeletonBone />
        </strong>
        <SkeletonBone shape="short" />
      </div>
      <p className="desc">
        <SkeletonBone />
      </p>
      <div className="row">
        <span className="prog skeleton-prog">
          <SkeletonBone />
        </span>
        <SkeletonBone shape="short" />
      </div>
      <div className="foot">
        <SkeletonBone shape="short" />
        <span className="sp" />
        <SkeletonBone shape="short" />
        <SkeletonBone shape="short" />
      </div>
    </div>
  </article>
);

// Mirrors ProjectDirectory: the filter bar and layout tabs are static; the
// counts and every project card are data.
const ProjectDirectorySkeleton = () => (
  <>
    <div className="toolbar project-toolbar" inert>
      <span className="skeleton-filter-select skeleton-search project-search">
        Search projects
      </span>
      <span className="skeleton-filter-select">
        All statuses
        <CaretDown aria-hidden="true" size={14} />
      </span>
      <span className="skeleton-filter-select">
        Recently active
        <CaretDown aria-hidden="true" size={14} />
      </span>
      <span className="btn btn-sm btn-secondary">Apply</span>
    </div>
    <nav aria-label="Project layout" className="tabs project-view-tabs">
      {VIEWS.map((view) => (
        <Link
          aria-current={view === "Grid" ? "page" : undefined}
          className={`tab${view === "Grid" ? " on" : ""}`}
          href="/projects"
          key={view}
        >
          {view}
        </Link>
      ))}
    </nav>
    <SkelterSurface label="Loading projects…">
      <div className="pgrid">
        {PROJECT_CARDS.map((key) => (
          <ProjectCardSkeleton key={key} />
        ))}
      </div>
    </SkelterSurface>
  </>
);

export {
  ProjectCounts,
  ProjectDirectory,
  ProjectDirectoryActions,
  ProjectDirectorySkeleton,
};
