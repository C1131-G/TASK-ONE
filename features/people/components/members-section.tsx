/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import { connection } from "next/server";

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { MembersDirectory } from "@/features/people/components/members-directory";
import { EmployeeCreateForm } from "@/features/people/components/people-admin-forms";
import type { MembersSectionName } from "@/features/people/members-section-param";
import { listEmployees, listTeams } from "@/features/people/people-queries";
import { getPageSession } from "@/src/server/auth/page-session";

const MembersSection = async ({
  section,
}: {
  readonly section: MembersSectionName;
}) => {
  await connection();
  const [result, teams, session] = await Promise.all([
    listEmployees({ search: "" }),
    listTeams({}),
    getPageSession(),
  ]);
  if (!result.ok) {
    return (
      <div className="panel panel-b" role="alert">
        Members could not be loaded. Refresh to retry.
      </div>
    );
  }
  const isAdmin =
    session.kind === "authenticated" && session.user.role === "admin";
  const teamList = teams.ok ? teams.data : [];
  return (
    <>
      <div className="ph">
        <div>
          <h1>Members</h1>
          <p>{result.data.length} people in your Metsys workspace.</p>
        </div>
        {isAdmin ? <EmployeeCreateForm teams={teamList} /> : null}
      </div>
      <MembersDirectory
        canManageMembers={isAdmin}
        employees={result.data}
        section={section}
        teams={teamList}
      />
    </>
  );
};

// The header carries the member count, so the skeleton repeats its static title.
const MembersSectionSkeleton = () => (
  <>
    <div className="ph">
      <div>
        <h1>Members</h1>
        <p className="muted">Loading people…</p>
      </div>
    </div>
    <PanelSkeleton label="Loading members…" rows={6} />
  </>
);

export { MembersSection, MembersSectionSkeleton };
