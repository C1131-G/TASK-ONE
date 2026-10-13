/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- Bug screens use reference workspace styles from workspace-reference.css. */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { listBugsAction } from "@/app/actions/bugs";
import { listEmployeesAction } from "@/app/actions/employees";
import { listProjectsAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BugBoard } from "@/components/workspace/bug-board";
import { BugList } from "@/components/workspace/bug-list";
import { BugReportDialog } from "@/components/workspace/bug-report-dialog";
import { TaskDrawerProvider } from "@/components/workspace/task-drawer";
import { getPageSession } from "@/src/server/auth/page-session";
import type { BugListItemSchema } from "@/src/server/work/bug-management";

export const metadata: Metadata = { title: "Bugs | Metsys" };

interface BugsSearchParams {
  readonly archived?: string;
  readonly q?: string;
  readonly severity?: string;
  readonly status?: string;
  readonly task?: string;
  readonly view?: string;
}

const statuses = [
  ["", "All"],
  ["reported", "Reported"],
  ["triaged", "Triaged"],
  ["in_progress", "In progress"],
  ["in_verification", "Verification"],
  ["awaiting_admin_approval", "Approval"],
  ["approved_for_release", "Approved"],
  ["released", "Released"],
  ["closed", "Closed"],
] as const;

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

const normalizedFilters = (params: BugsSearchParams) => {
  const status = statuses.some(([value]) => value === params.status)
    ? params.status
    : "";
  const severity = [
    "blocker",
    "critical",
    "major",
    "minor",
    "trivial",
  ].includes(params.severity ?? "")
    ? params.severity
    : undefined;
  return { severity, status };
};

const BugsContent = async ({
  searchParams,
}: {
  readonly searchParams: Promise<BugsSearchParams>;
}) => {
  await connection();
  const [params, projectsResult, employeeResult, session] = await Promise.all([
    searchParams,
    listProjectsAction({}),
    listEmployeesAction({ search: "" }),
    getPageSession(),
  ]);
  const { severity, status } = normalizedFilters(params);
  const bugsResult = await listBugsAction({
    includeArchived: params.archived === "true",
    ...(params.q ? { query: params.q } : {}),
    ...(severity ? { severity } : {}),
    ...(status ? { status } : {}),
  });
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
            defaultValue={params.q ?? ""}
            id="bug-search"
            name="q"
            placeholder="Search reports, components, and past fixes"
            type="search"
          />
          <Button type="submit">Search</Button>
          <Link
            className="btn btn-ghost"
            href={
              (params.archived === "true"
                ? "/bugs"
                : "/bugs?archived=true") as Route
            }
          >
            {params.archived === "true" ? "Active bugs" : "Include archived"}
          </Link>
        </form>
      </search>
      <nav aria-label="Filter bugs by status" className="bug-status-filters">
        {statuses.map(([value, label]) => {
          const query = new URLSearchParams();
          if (value) {
            query.set("status", value);
          }
          if (params.q) {
            query.set("q", params.q);
          }
          if (params.archived === "true") {
            query.set("archived", "true");
          }
          return (
            <Link
              aria-current={(status ?? "") === value ? "page" : undefined}
              className={`bug-status-filter${(status ?? "") === value ? " selected" : ""}`}
              href={`/bugs${query.size ? `?${query.toString()}` : ""}` as Route}
              key={value || "all"}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <nav aria-label="Bug display" className="bug-view-switch">
        <Link
          aria-current={params.view === "board" ? undefined : "page"}
          href="/bugs"
          className={params.view === "board" ? "" : "selected"}
        >
          List
        </Link>
        <Link
          aria-current={params.view === "board" ? "page" : undefined}
          href="/bugs?view=board"
          className={params.view === "board" ? "selected" : ""}
        >
          Board
        </Link>
      </nav>
      {bugsResult.ok ? (
        <TaskDrawerProvider
          currentUserId={currentUserId}
          editableTaskIds={drawer.editableTaskIds}
          employees={employees.map(({ id, name }) => ({ id, name }))}
          initialTaskId={params.task ?? null}
          isAdmin={isAdmin}
          tasks={drawer.tasks}
        >
          {params.view === "board" ? (
            <BugBoard bugs={bugs} />
          ) : (
            <BugList bugs={bugs} />
          )}
        </TaskDrawerProvider>
      ) : (
        <section className="panel panel-b" role="alert">
          Bug reports could not be loaded. Refresh the page to retry.
        </section>
      )}
    </section>
  );
};

const BugsLoading = () => (
  <output aria-busy="true" aria-live="polite" className="panel panel-b muted">
    Loading bug reports…
  </output>
);

const BugsPage = ({
  searchParams,
}: {
  readonly searchParams: Promise<BugsSearchParams>;
}) => (
  <div className="page flush">
    <Suspense fallback={<BugsLoading />}>
      <BugsContent searchParams={searchParams} />
    </Suspense>
  </div>
);

export default BugsPage;
