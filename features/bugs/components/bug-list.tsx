"use client";

import { ArrowUpRight, Bug } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { BugPickDialog } from "@/features/bugs/components/bug-pick-dialog";
import { useTaskDrawer } from "@/features/tasks/components/task-drawer";
import type { BugListItemSchema } from "@/src/server/work/bug-management";

/* eslint-disable shadcn/no-unknown-classes -- Bug list styles are defined in app/workspace-styles. */
/* eslint-disable shadcn/no-restyle -- Drawer action follows existing workspace button styling. */

type BugListItem = typeof BugListItemSchema.Type;

const severityLabel: Record<BugListItem["bug"]["severity"], string> = {
  blocker: "Blocker",
  critical: "Critical",
  major: "Major",
  minor: "Minor",
  trivial: "Trivial",
};

const statusLabel: Record<BugListItem["bug"]["status"], string> = {
  approved_for_release: "Approved for release",
  awaiting_admin_approval: "Awaiting approval",
  awaiting_client: "Awaiting client",
  closed: "Closed",
  duplicate: "Duplicate",
  in_progress: "In progress",
  in_verification: "In verification",
  needs_info: "Needs info",
  rejected: "Changes requested",
  released: "Released",
  reported: "Reported",
  triaged: "Triaged",
  withdrawn: "Withdrawn",
};

const impactLabel = {
  high: "High impact",
  low: "Low impact",
  medium: "Medium impact",
  urgent: "Urgent impact",
} as const;

const DAY_MS = 86_400_000;

const ageLabel = (discoveredAt: string): string => {
  const days = Math.floor((Date.now() - Date.parse(discoveredAt)) / DAY_MS);
  if (days < 1) {
    return "Today";
  }
  return days === 1 ? "1 day old" : `${days} days old`;
};

export const BugCard = ({
  bugEntry,
  clientQueue,
}: {
  readonly bugEntry: BugListItem;
  // Set in the client queue: handlers get Pick, admins get an Assign link.
  readonly clientQueue?: { readonly isAdmin: boolean } | undefined;
}) => {
  const drawer = useTaskDrawer();
  const { archived, assigneeIds, bug, priority, projectName, relatedBugIds } =
    bugEntry;
  return (
    <article className="panel panel-b bug-list-item" key={bug.id}>
      <Link className="bug-list-link" href={`/bugs/${bug.id}`}>
        <span
          aria-hidden="true"
          className={`bug-severity bug-severity-${bug.severity}`}
        />
        <div className="bug-list-main">
          <div className="bug-list-title-row">
            <span className="bug-task-key">
              {bug.projectKey}-{bug.projectTaskNumber}
            </span>
            <h2>{bug.title}</h2>
            {bug.clientCompanyId ? (
              <span className="bug-client-badge">Client report</span>
            ) : null}
            {bug.clientImpact ? (
              <span
                className={`bug-impact-chip bug-impact-${bug.clientImpact}`}
              >
                {impactLabel[bug.clientImpact]}
              </span>
            ) : null}
            {relatedBugIds.length > 0 ? (
              <span className="bug-related-count">
                {relatedBugIds.length} related
              </span>
            ) : null}
          </div>
          <p className="bug-list-context">
            {projectName} · {bug.component} · {bug.route}
          </p>
          <div className="bug-list-meta">
            <span>{severityLabel[bug.severity]}</span>
            <span>{statusLabel[bug.status]}</span>
            <span>Priority {priority}</span>
            <span>
              {assigneeIds.length === 1
                ? "1 assignee"
                : `${assigneeIds.length} assignees`}
            </span>
            {clientQueue ? (
              <span suppressHydrationWarning>{ageLabel(bug.discoveredAt)}</span>
            ) : null}
            {archived ? <span>Archived</span> : null}
            {bug.discoverySource.replaceAll("_", " ")}
          </div>
        </div>
        <ArrowUpRight aria-hidden="true" className="bug-list-arrow" size={16} />
      </Link>
      {clientQueue?.isAdmin ? (
        <Link
          className="btn btn-outline bug-open-drawer"
          href={`/bugs/${bug.id}`}
        >
          Assign
        </Link>
      ) : null}
      {clientQueue && !clientQueue.isAdmin ? (
        <BugPickDialog
          bugId={bug.id}
          severity={bug.severity}
          title={bug.title}
          version={bug.version}
        />
      ) : null}
      {drawer && !clientQueue ? (
        <Button
          className="bug-open-drawer"
          onClick={() => drawer.openTask(bug.taskId)}
          size="sm"
          type="button"
          variant="outline"
        >
          Open workflow
        </Button>
      ) : null}
    </article>
  );
};

export const BugList = ({
  bugs,
  clientQueue,
  emptyMessage = "No bug reports match these filters.",
}: {
  readonly clientQueue?: { readonly isAdmin: boolean } | undefined;
  readonly bugs: readonly BugListItem[];
  readonly emptyMessage?: string;
}) => {
  if (bugs.length === 0) {
    return (
      <output className="panel panel-b muted bug-empty">
        <Bug aria-hidden="true" size={22} />
        <p>{emptyMessage}</p>
      </output>
    );
  }

  return (
    <div aria-label="Bug reports" className="bug-list">
      {bugs.map((bugEntry) => (
        <BugCard
          bugEntry={bugEntry}
          clientQueue={clientQueue}
          key={bugEntry.bug.id}
        />
      ))}
    </div>
  );
};
