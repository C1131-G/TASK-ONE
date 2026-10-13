/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles -- Workspace classes are defined in app/workspace-styles. */

import type { Route } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { TeamCreateForm } from "@/features/people/components/people-admin-forms";
import { TeamAdminControls } from "@/features/people/components/team-admin-controls";
import { listTeams } from "@/features/people/people-queries";
import { getPageSession } from "@/src/server/auth/page-session";

const TeamList = async () => {
  await connection();
  const [result, session] = await Promise.all([
    listTeams({}),
    getPageSession(),
  ]);
  if (!result.ok) {
    return (
      <div className="panel panel-b" role="alert">
        Teams could not be loaded. Refresh to retry.
      </div>
    );
  }
  return (
    <>
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
                <Link
                  className="team-card-link grow"
                  href={`/teams/${team.id}` as Route}
                >
                  <strong>{team.name}</strong>
                  <span className="muted">{team.memberCount} members</span>
                </Link>
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
    </>
  );
};

const TeamListSkeleton = () => (
  <PanelSkeleton label="Loading teams…" rows={4} />
);

export { TeamList, TeamListSkeleton };
