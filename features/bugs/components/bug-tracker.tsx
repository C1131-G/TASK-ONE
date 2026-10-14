/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- Bug screens use reference workspace styles from app/workspace-styles. */

import Link from "next/link";
import { connection } from "next/server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { BUG_STATUS_FILTERS } from "@/features/bugs/bug-filters";
import type { BugFilters } from "@/features/bugs/bug-filters";
import { listBugs } from "@/features/bugs/bugs-queries";
import { BugBoard } from "@/features/bugs/components/bug-board";
import { BugList } from "@/features/bugs/components/bug-list";
import { BugReportDialog } from "@/features/bugs/components/bug-report-dialog";
import { listAllEmployees } from "@/features/people/people-queries";
import { listProjects } from "@/features/projects/projects-queries";
import { TaskDrawerHost } from "@/features/tasks/components/task-drawer-host";
import { getPageSession } from "@/src/server/auth/page-session";
import type { BugListItemSchema } from "@/src/server/work/bug-management";

const drawerData = (
  bugs: readonly (typeof BugListItemSchema.Type)[],
  userId: string | null,
  isAdmin: boolean
) => {
  const tasks: {
    readonly bugId: string;
    readonly id: string;
    readonly projectId: string;
    readonly title: string;
    readonly type: "bug";
    readonly version: number;
  }[] = [];
  const editableTaskIds: string[] = [];
  for (const { assigneeIds, bug } of bugs) {
    tasks.push({
      bugId: bug.id,
      id: bug.taskId,
      projectId: bug.projectId,
      title: bug.title,
      type: "bug",
      version: bug.version,
    });
    if (
      isAdmin ||
      bug.reporterId === userId ||
      assigneeIds.includes(userId ?? "")
    ) {
      editableTaskIds.push(bug.taskId);
    }
  }
  return { editableTaskIds, tasks };
};

const BugTracker = async ({ filters }: { readonly filters: BugFilters }) => {
  await connection();
  const [projectsResult, employeeResult, session, bugsResult] =
    await Promise.all([
      listProjects({}),
      listAllEmployees(),
      getPageSession(),
      listBugs({
        includeArchived: filters.archived,
        ...(filters.query ? { query: filters.query } : {}),
        ...(filters.severity ? { severity: filters.severity } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      }),
    ]);
  const projects = projectsResult.ok ? projectsResult.data : [];
  const employees = employeeResult.ok ? employeeResult.data : [];
  const bugs = bugsResult.ok ? bugsResult.data : [];
  const isAdmin =
    session.kind === "authenticated" && session.user.role === "admin";
  const currentUserId =
    session.kind === "authenticated" ? session.user.id : null;
  const drawer = drawerData(bugs, currentUserId, isAdmin);
  return (
    <section aria-labelledby="bugs-heading" className="page bug-page">
      <header className="bug-page-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 id="bugs-heading">Bugs</h1>
          <p className="muted">
            Track issues, compare earlier fixes, and follow each release.
          </p>
        </div>
        <BugReportDialog
          projects={projects.map(({ id, key, name }) => ({ id, key, name }))}
        />
      </header>
      <search>
        <form action="/bugs" className="bug-filter-form">
          <label className="sr-only" htmlFor="bug-search">
            Search bugs and fix history
          </label>
          <Input
            autoComplete="off"
            className="bug-search"
            defaultValue={filters.query}
            id="bug-search"
            name="q"
            placeholder="Search reports, components, and past fixes"
            type="search"
          />
          <Button type="submit">Search</Button>
          <Link
            className="btn btn-ghost"
            href={filters.archived ? "/bugs" : "/bugs?archived=true"}
          >
            {filters.archived ? "Active bugs" : "Include archived"}
          </Link>
        </form>
      </search>
      <nav aria-label="Filter bugs by status" className="bug-status-filters">
        {BUG_STATUS_FILTERS.map(([value, label]) => {
          const query = new URLSearchParams();
          if (value) {
            query.set("status", value);
          }
          if (filters.query) {
            query.set("q", filters.query);
          }
          if (filters.archived) {
            query.set("archived", "true");
          }
          return (
            <Link
              aria-current={filters.status === value ? "page" : undefined}
              className={`bug-status-filter${filters.status === value ? " selected" : ""}`}
              href={query.size ? `/bugs?${query.toString()}` : "/bugs"}
              key={value || "all"}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <nav aria-label="Bug display" className="bug-view-switch">
        <Link
          aria-current={filters.view === "board" ? undefined : "page"}
          href="/bugs"
          className={filters.view === "board" ? "" : "selected"}
        >
          List
        </Link>
        <Link
          aria-current={filters.view === "board" ? "page" : undefined}
          href="/bugs?view=board"
          className={filters.view === "board" ? "selected" : ""}
        >
          Board
        </Link>
      </nav>
      {bugsResult.ok ? (
        <TaskDrawerHost
          currentUserId={currentUserId}
          editableTaskIds={drawer.editableTaskIds}
          employees={employees.map(({ id, name }) => ({ id, name }))}
          initialTaskId={filters.taskId}
          isAdmin={isAdmin}
          tasks={drawer.tasks}
        >
          {filters.view === "board" ? (
            <BugBoard bugs={bugs} />
          ) : (
            <BugList bugs={bugs} />
          )}
        </TaskDrawerHost>
      ) : (
        <section className="panel panel-b" role="alert">
          Bug reports could not be loaded. Refresh the page to retry.
        </section>
      )}
    </section>
  );
};

// The header holds the report dialog, which needs projects, so the skeleton
// repeats its static title to keep the heading in place.
const BugTrackerSkeleton = () => (
  <section aria-labelledby="bugs-heading" className="page bug-page">
    <header className="bug-page-header">
      <div>
        <p className="eyebrow">Workspace</p>
        <h1 id="bugs-heading">Bugs</h1>
        <p className="muted">
          Track issues, compare earlier fixes, and follow each release.
        </p>
      </div>
    </header>
    <PanelSkeleton label="Loading bug reports…" rows={6} />
  </section>
);

export { BugTracker, BugTrackerSkeleton };
