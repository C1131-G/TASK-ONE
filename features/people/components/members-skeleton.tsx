/* eslint-disable shadcn/no-restyle */
/* eslint-disable shadcn/no-unknown-classes -- Skeletons mirror the members directory markup. */

import Link from "next/link";

import { Input } from "@/components/ui/input";
import {
  SkeletonBone,
  SkeletonDataGrid,
} from "@/components/workspace/skeleton-shapes";

const COLUMNS = [
  "Member",
  "Role",
  "Team",
  "Active projects",
  "Open tasks",
  "Employee ID",
  "Status",
] as const;
const ROLE_FILTERS = ["All", "Admin", "Employee"] as const;

// Mirrors MembersSection + MembersDirectory: titles, tabs, filters and column
// headings are static; the count and every row cell are data.
const MembersSectionSkeleton = () => (
  <>
    <div className="ph">
      <div>
        <h1>Members</h1>
        <p>
          <SkeletonBone />
        </p>
      </div>
    </div>
    <div className="members-workspace">
      <nav aria-label="People" className="members-section-nav">
        <Link aria-current="page" href="/members">
          Members
        </Link>
        <Link href="/teams">Teams</Link>
        <Link href="/members?section=roles">Roles &amp; permissions</Link>
      </nav>
      <section aria-label="Workspace members" className="panel members-panel">
        <div className="panel-h members-toolbar">
          <span className="ct">
            <SkeletonBone shape="short" />
          </span>
          <div className="members-controls" inert>
            <Input
              aria-label="Search members"
              className="members-search"
              placeholder="Search members"
              type="search"
            />
            <div aria-hidden="true" className="members-role-filter">
              {ROLE_FILTERS.map((label) => (
                <span className="btn btn-sm btn-ghost" key={label}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <SkeletonDataGrid
          columns={COLUMNS}
          label="Loading members…"
          rows={14}
          widths="2.2fr 1fr 1fr 1.3fr 1fr 1.3fr 1fr"
        />
      </section>
    </div>
  </>
);

export { MembersSectionSkeleton };
