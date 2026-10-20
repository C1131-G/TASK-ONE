/* eslint-disable shadcn/no-restyle -- Skeletons reuse the workspace tab and input classes. */
/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import Link from "next/link";

import { Input } from "@/components/ui/input";
import {
  SkeletonBone,
  SkeletonDataGrid,
} from "@/components/workspace/skeleton-shapes";
import { MembersDirectory } from "@/features/people/components/members-directory";
import { EmployeeCreateForm } from "@/features/people/components/people-admin-forms";
import type { MembersSectionName } from "@/features/people/members-section-param";
import {
  listAllEmployees,
  listAllTeams,
} from "@/features/people/people-queries";
import { readOrThrow } from "@/lib/read-result";
import { getPageSession } from "@/src/server/auth/page-session";

const MembersSection = async ({
  section,
}: {
  readonly section: MembersSectionName;
}) => {
  const [result, teams, session] = await Promise.all([
    listAllEmployees(),
    listAllTeams(),
    getPageSession(),
  ]);
  const employees = readOrThrow(result, "Members");
  const isAdmin =
    session.kind === "authenticated" && session.user.role === "admin";
  return (
    <MembersDirectory
      canManageMembers={isAdmin}
      employees={employees}
      section={section}
      teams={teams.ok ? teams.data : []}
    />
  );
};

const MembersCount = async () => {
  const employees = readOrThrow(await listAllEmployees(), "Members");
  return `${employees.length} people in your Metsys workspace.`;
};

// Only admins add members; others see no action, so there is no space to hold.
const MembersActions = async () => {
  const [session, teams] = await Promise.all([
    getPageSession(),
    listAllTeams(),
  ]);
  if (session.kind !== "authenticated" || session.user.role !== "admin") {
    return null;
  }
  return <EmployeeCreateForm teams={teams.ok ? teams.data : []} />;
};

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
        rows={5}
        widths="2.2fr 1fr 1fr 1.3fr 1fr 1.3fr 1fr"
      />
    </section>
  </div>
);

export { MembersActions, MembersCount, MembersSection, MembersSectionSkeleton };
