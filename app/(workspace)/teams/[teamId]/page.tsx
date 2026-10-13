/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import {
  TeamDetail,
  TeamDetailSkeleton,
} from "@/features/people/components/team-detail";
import { teamMetadata } from "@/features/people/team-metadata";

export const instant = false;
export const generateMetadata = async ({
  params,
}: PageProps<"/teams/[teamId]">): Promise<Metadata> => {
  const { teamId } = await params;
  return await teamMetadata(teamId);
};

const TeamPage = ({ params }: PageProps<"/teams/[teamId]">) => (
  <div className="page">
    <Suspense fallback={<TeamDetailSkeleton />}>
      {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
      {params.then(({ teamId }) => (
        <TeamDetail teamId={teamId} />
      ))}
    </Suspense>
  </div>
);

export default TeamPage;
