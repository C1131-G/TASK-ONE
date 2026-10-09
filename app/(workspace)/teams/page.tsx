/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */

import type { Metadata } from "next";
import { connection } from "next/server";

import { listTeamsAction } from "@/app/actions/teams";
import { TeamCreateForm } from "@/components/workspace/people-admin-forms";
import { TeamAdminControls } from "@/components/workspace/team-admin-controls";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "Teams | Metsys" };

const TeamsPage = async () => {
  await connection();
  const [result, session] = await Promise.all([
    listTeamsAction({}),
    getPageSession(),
  ]);
  if (!result.ok) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Teams could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }
  return (
    <div className="page">
      <div className="ph">
        <div>
          <h1>Teams</h1>
          <p>Organize employees by team.</p>
        </div>
      </div>
      {session.kind === "authenticated" && session.user.role === "admin" ? (
        <TeamCreateForm />
      ) : null}
      {result.data.length ? (
        <div className="pgrid">
          {result.data.map((team) => (
            <article className="pcard" key={team.id}>
              <div className="row">
                <span
                  aria-hidden="true"
                  className="pico"
                  style={{ "--c": team.color } as React.CSSProperties}
                >
                  ●
                </span>
                <strong className="grow">{team.name}</strong>
              </div>
              <p className="desc">{team.description || "No description"}</p>
              {session.kind === "authenticated" &&
              session.user.role === "admin" ? (
                <TeamAdminControls team={team} />
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <section className="panel panel-b">
          <h2>No teams yet</h2>
        </section>
      )}
    </div>
  );
};

export default TeamsPage;
