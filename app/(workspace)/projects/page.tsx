/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles, shadcn/no-restyle */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { getPersonalWorkspaceAction } from "@/app/actions/discovery";
import { listEmployeesAction } from "@/app/actions/employees";
import { listProjectsAction } from "@/app/actions/projects";
import { ProjectCreateForm } from "@/components/workspace/project-create-form";
import {
  ProjectGridView,
  ProjectListView,
  ProjectTableView,
} from "@/components/workspace/project-list-layouts";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "Projects | Metsys" };

const statusLabel: Record<string, string> = {
  active: "In Progress",
  complete: "Completed",
  hold: "On Hold",
  planning: "Planning",
  risk: "At Risk",
};

const projectStatuses = [
  "planning",
  "active",
  "risk",
  "hold",
  "complete",
] as const;
const projectSorts = ["recent", "name", "due", "progress"] as const;
const projectViews = ["grid", "list", "table"] as const;

const firstParam = (value: string | string[] | undefined): string =>
  typeof value === "string" ? value : "";

const projectHref = (
  values: Readonly<Record<string, string>>,
  view: string
): Route => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) {
      params.set(key, value);
    }
  }
  params.set("view", view);
  return `/projects?${params.toString()}` as Route;
};

const ProjectsPage = async ({ searchParams }: PageProps<"/projects">) => {
  await connection();
  const [params, result, session, personal, employeeResult] = await Promise.all(
    [
      searchParams,
      listProjectsAction({}),
      getPageSession(),
      getPersonalWorkspaceAction({}),
      listEmployeesAction({ search: "" }),
    ]
  );
  if (!result.ok) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Projects could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }
  const favoriteProjectIds = new Set(
    personal.ok ? personal.data.projects.map((project) => project.id) : []
  );
  const query = firstParam(params.q).trim().slice(0, 120);
  const rawStatus = firstParam(params.status);
  const selectedStatus =
    projectStatuses.find((status) => status === rawStatus) ?? "";
  const rawSort = firstParam(params.sort);
  const sort = projectSorts.find((option) => option === rawSort) ?? "recent";
  const rawView = firstParam(params.view);
  const view = projectViews.find((option) => option === rawView) ?? "grid";
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
    <div className="page">
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
    </div>
  );
};

export default ProjectsPage;
