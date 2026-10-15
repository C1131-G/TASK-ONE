/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import Link from "next/link";

import type { ClientStatusLabel } from "@/features/portal/client-status";
import {
  clientStatusLabels,
  clientStatusText,
} from "@/features/portal/client-status";

// A plain GET form: filters live in the URL, so they work without scripts and
// can be shared or bookmarked.
const PortalBugFilters = ({
  mine,
  projectId,
  projects,
  status,
}: {
  readonly mine: boolean;
  readonly projectId: string | undefined;
  readonly projects: readonly { readonly id: string; readonly name: string }[];
  readonly status: ClientStatusLabel | undefined;
}) => (
  <form action="/portal" className="panel portal-filters" method="get">
    <div className="field">
      <label className="label" htmlFor="portal-filter-status">
        Status
      </label>
      <select
        className="select"
        defaultValue={status ?? ""}
        id="portal-filter-status"
        name="status"
      >
        <option value="">All statuses</option>
        {clientStatusLabels.map((label) => (
          <option key={label} value={label}>
            {clientStatusText[label]}
          </option>
        ))}
      </select>
    </div>
    <div className="field">
      <label className="label" htmlFor="portal-filter-project">
        Project
      </label>
      <select
        className="select"
        defaultValue={projectId ?? ""}
        id="portal-filter-project"
        name="project"
      >
        <option value="">All projects</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </div>
    <label className="portal-check" htmlFor="portal-filter-mine">
      <input
        defaultChecked={mine}
        id="portal-filter-mine"
        name="mine"
        type="checkbox"
        value="1"
      />
      <span>Reported by me</span>
    </label>
    <div className="portal-filter-acts">
      <button className="btn btn-secondary" type="submit">
        Apply filters
      </button>
      <Link className="btn btn-ghost" href="/portal">
        Clear
      </Link>
    </div>
  </form>
);

export { PortalBugFilters };
