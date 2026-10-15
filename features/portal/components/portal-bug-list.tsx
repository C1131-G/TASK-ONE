/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { Bug } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { PortalBugFilters } from "@/features/portal/components/portal-bug-filters";
import { PortalStatusChip } from "@/features/portal/components/portal-status-chip";
import { PortalTime } from "@/features/portal/components/portal-time";
import type { PortalBugFilterValues } from "@/features/portal/portal-filters";
import { impactText } from "@/features/portal/portal-format";
import {
  listPortalBugs,
  listPortalProjects,
} from "@/features/portal/portal-queries";
import type { PortalBugSummary } from "@/src/server/portal/portal-contracts";

const PortalBugItems = ({
  bugs,
  filtered,
}: {
  readonly bugs: readonly PortalBugSummary[];
  readonly filtered: boolean;
}) => {
  if (bugs.length === 0) {
    return (
      <div className="panel empty-state">
        <span aria-hidden="true" className="glyph">
          <Bug size={22} />
        </span>
        <h2 className="es-h">
          {filtered ? "No bugs match these filters" : "No bugs reported yet"}
        </h2>
        <p>
          {filtered
            ? "Try clearing a filter to see more of your company's bugs."
            : "When you or your colleagues report a bug, it shows up here so everyone can follow it."}
        </p>
        {filtered ? (
          <Link className="btn btn-secondary" href="/portal">
            Clear filters
          </Link>
        ) : (
          <Link className="btn btn-primary" href="/portal/new">
            Report a bug
          </Link>
        )}
      </div>
    );
  }
  return (
    <ul aria-label="Company bugs" className="portal-bug-list">
      {bugs.map((bug) => (
        <li key={bug.id}>
          <Link className="portal-bug-card" href={`/portal/bugs/${bug.id}`}>
            <span className="portal-bug-top">
              <span className="portal-bug-key">{bug.key}</span>
              <PortalStatusChip status={bug.status} />
            </span>
            <strong className="portal-bug-title">{bug.title}</strong>
            <span className="portal-bug-meta">
              <span>{bug.projectName}</span>
              {bug.impact ? (
                <span>Impact: {impactText[bug.impact]}</span>
              ) : null}
              <span>
                {bug.isMine
                  ? "Reported by you"
                  : `Reported by ${bug.reporterName}`}
              </span>
              <span>
                Updated <PortalTime iso={bug.updatedAt} />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};

const PortalBugList = async ({
  filters,
}: {
  readonly filters: PortalBugFilterValues;
}) => {
  const projectsResult = await listPortalProjects({});
  const projects = projectsResult.ok ? projectsResult.data : [];
  // Only a project the company actually has is passed on as a filter.
  const projectId = projects.find(({ id }) => id === filters.project)?.id;
  const result = await listPortalBugs({
    ...(filters.mine ? { mine: true } : {}),
    ...(projectId ? { projectId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  });
  const filtered = Boolean(filters.mine || projectId || filters.status);

  return (
    <>
      <div className="ph">
        <div>
          <h1>Company bugs</h1>
          <p>Every bug your company has reported, and where it stands.</p>
        </div>
        <div className="acts">
          <Link className="btn btn-primary" href="/portal/new">
            Report a bug
          </Link>
        </div>
      </div>
      <PortalBugFilters
        mine={filters.mine}
        projectId={projectId}
        projects={projects}
        status={filters.status}
      />
      {result.ok ? (
        <PortalBugItems bugs={result.data} filtered={filtered} />
      ) : (
        <div className="panel portal-alert" role="alert">
          Bugs could not be loaded. Refresh to try again.
        </div>
      )}
    </>
  );
};

export { PortalBugList };
