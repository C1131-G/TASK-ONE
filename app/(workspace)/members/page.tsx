/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { connection } from "next/server";

import { listEmployeesAction } from "@/app/actions/employees";
import { listTeamsAction } from "@/app/actions/teams";
import { MembersDirectory } from "@/components/workspace/members-directory";
import { EmployeeCreateForm } from "@/components/workspace/people-admin-forms";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "Members | Metsys" };

const MembersPage = async ({ searchParams }: PageProps<"/members">) => {
  await connection();
  const params = await searchParams;
  const section = params.section === "roles" ? "roles" : "members";
  const [result, teams, session] = await Promise.all([
    listEmployeesAction({ search: "" }),
    listTeamsAction({}),
    getPageSession(),
  ]);
  if (!result.ok) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Members could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }
  return (
    <div className="page">
      <div className="ph">
        <div>
          <h1>Members</h1>
          <p>{result.data.length} people in your Metsys workspace.</p>
        </div>
        {session.kind === "authenticated" && session.user.role === "admin" ? (
          <EmployeeCreateForm teams={teams.ok ? teams.data : []} />
        ) : null}
      </div>
      <MembersDirectory
        canManageMembers={
          session.kind === "authenticated" && session.user.role === "admin"
        }
        employees={result.data}
        section={section}
        teams={teams.ok ? teams.data : []}
      />
    </div>
  );
};

export default MembersPage;
