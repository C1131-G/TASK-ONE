/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { connection } from "next/server";

import { listEmployeesAction } from "@/app/actions/employees";
import { listTeamsAction } from "@/app/actions/teams";
import { EmployeeAdminControls } from "@/components/workspace/employee-admin-controls";
import { EmployeeCreateForm } from "@/components/workspace/people-admin-forms";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "Members | Metsys" };

const MembersPage = async () => {
  await connection();
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
          <p>People in your Metsys workspace.</p>
        </div>
      </div>
      {session.kind === "authenticated" && session.user.role === "admin" ? (
        <EmployeeCreateForm teams={teams.ok ? teams.data : []} />
      ) : null}
      {result.data.length ? (
        <section className="panel">
          <div className="panel-h">
            <h2>People</h2>
            <span className="ct">{result.data.length}</span>
          </div>
          <div className="panel-b feed lined">
            {result.data.map((employee) => (
              <article className="row" key={employee.id}>
                <span aria-hidden="true" className="av">
                  {employee.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="grow">
                  <strong>{employee.name}</strong>
                  <p className="muted">
                    {employee.jobTitle || "Team member"}
                    {employee.teamName ? ` · ${employee.teamName}` : ""}
                  </p>
                </div>
                <span className="ct">
                  {employee.role === "admin" ? "Admin" : "Employee"}
                </span>
                {session.kind === "authenticated" &&
                session.user.role === "admin" ? (
                  <EmployeeAdminControls
                    employee={employee}
                    teams={teams.ok ? teams.data : []}
                  />
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="panel panel-b">
          <h2>No members found</h2>
        </section>
      )}
    </div>
  );
};

export default MembersPage;
