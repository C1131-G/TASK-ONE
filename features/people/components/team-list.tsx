/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles -- Workspace classes are defined in app/workspace-styles. */

import Link from "next/link";

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
import { TeamAdminControls } from "@/features/people/components/team-admin-controls";
import { TeamCreateForm } from "@/features/people/components/team-create-form";
import { listTeams } from "@/features/people/people-queries";
import { getPageSession } from "@/src/server/auth/page-session";

const TeamList = async () => {
  const [result, session] = await Promise.all([
    listTeams({}),
    getPageSession(),
  ]);
  if (!result.ok) {
    throw new Error("Teams could not be loaded.");
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
                  style={{ "--c": team.color }}
                >
                  ●
                </span>
                <Link
                  className="team-card-link grow"
                  href={`/teams/${team.id}`}
                  transitionTypes={["nav-forward"]}
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

const TEAM_CARDS = SKELETON_KEYS.slice(0, 3);

// Mirrors the team card: dot, name and member count, then the description.
const TeamListSkeleton = () => (
  <SkelterSurface label="Loading teams…">
    <div className="pgrid">
      {TEAM_CARDS.map((key) => (
        <article className="pcard" key={key}>
          <div className="row">
            <SkeletonBone shape="avatar" />
            <div className="team-card-link grow">
              <SkeletonBone />
              <SkeletonBone shape="short" />
            </div>
          </div>
          <p className="desc">
            <SkeletonBone />
          </p>
        </article>
      ))}
    </div>
  </SkelterSurface>
);

export { TeamList, TeamListSkeleton };
