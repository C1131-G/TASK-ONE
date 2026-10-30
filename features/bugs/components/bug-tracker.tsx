/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- Bug screens use reference workspace styles from apps/web/app/workspace-styles. */

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ViewSwitchTransition } from "@/components/ui/view-switch-transition";
import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { BUG_STATUS_FILTERS } from "@/features/bugs/bug-filters";
import type { BugFilters } from "@/features/bugs/bug-filters";
import { listBugs } from "@/features/bugs/bugs-queries";
import { BugBoard } from "@/features/bugs/components/bug-board";
import { BugList } from "@/features/bugs/components/bug-list";
import { BugReportDialog } from "@/features/bugs/components/bug-report-dialog";
import { listAllEmployees } from "@/features/people/people-queries";
import { listAllProjects } from "@/features/projects/projects-queries";
import { TaskDrawerHost } from "@/features/tasks/components/task-drawer-host";
import { readOrThrow } from "@/lib/read-result";
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

const BugViewContent = ({
  bugs,
  isAdmin,
  view,
}: {
  readonly bugs: readonly (typeof BugListItemSchema.Type)[];
  readonly isAdmin: boolean;
  readonly view: BugFilters["view"];
}) => {
  if (view === "board") {
    return <BugBoard bugs={bugs} />;
  }
  if (view === "client_queue") {
    return (
      <BugList
        bugs={bugs}
        clientQueue={{ isAdmin }}
        emptyMessage="No client bugs are waiting to be picked up."
      />
    );
  }
  return <BugList bugs={bugs} />;
};

const BugTracker = async ({ filters }: { readonly filters: BugFilters }) => {
  const isQueue = filters.view === "client_queue";
  const [employeeResult, session, bugsResult] = await Promise.all([
    listAllEmployees(),
    getPageSession(),
    listBugs({
      ...(isQueue ? { view: "client_queue" } : {}),
      includeArchived: filters.archived,
      ...(filters.query ? { query: filters.query } : {}),
      ...(filters.severity ? { severity: filters.severity } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    }),
  ]);
  const employees = employeeResult.ok ? employeeResult.data : [];
  const bugs = readOrThrow(bugsResult, "Bug reports");
  const isAdmin =
    session.kind === "authenticated" && session.user.role === "admin";
  const currentUserId =
    session.kind === "authenticated" ? session.user.id : null;
  const drawer = drawerData(bugs, currentUserId, isAdmin);
  return (
    <>
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
      {isQueue ? null : (
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
      )}
      <nav aria-label="Bug display" className="bug-view-switch">
        <Link
          aria-current={filters.view === "list" ? "page" : undefined}
          href="/bugs"
          className={filters.view === "list" ? "selected" : ""}
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
        <Link
          aria-current={isQueue ? "page" : undefined}
          href="/bugs?view=client_queue"
          className={isQueue ? "selected" : ""}
        >
          Client queue
        </Link>
      </nav>
      <TaskDrawerHost
        currentUserId={currentUserId}
        editableTaskIds={drawer.editableTaskIds}
        employees={employees.map(({ id, name }) => ({ id, name }))}
        initialTaskId={filters.taskId}
        isAdmin={isAdmin}
        tasks={drawer.tasks}
      >
        <ViewSwitchTransition name="bug-view" view={filters.view}>
          <BugViewContent bugs={bugs} isAdmin={isAdmin} view={filters.view} />
        </ViewSwitchTransition>
      </TaskDrawerHost>
    </>
  );
};

// The report action needs the project list; everything else in the header is
// static and lives in the page.
const BugReportAction = async () => {
  const projects = readOrThrow(await listAllProjects(), "Projects");
  return (
    <BugReportDialog
      projects={projects.map(({ id, key, name }) => ({ id, key, name }))}
    />
  );
};

// With no projects the dialog renders its disabled trigger, the same size as
// the real one.
const BugReportActionSkeleton = () => <BugReportDialog projects={[]} />;

const BugTrackerSkeleton = () => (
  <PanelSkeleton variant="bugs" label="Loading bug reports…" rows={5} />
);

export {
  BugReportAction,
  BugReportActionSkeleton,
  BugTracker,
  BugTrackerSkeleton,
};
