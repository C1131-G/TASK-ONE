/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { TeamDetail } from "@/features/people/components/team-detail";
import { TeamDetailSkeleton } from "@/features/people/components/team-detail-skeleton";
import { teamMetadata } from "@/features/people/team-metadata";

export const generateMetadata = async ({
  params,
}: PageProps<"/teams/[teamId]">): Promise<Metadata> => {
  const { teamId } = await params;
  return await teamMetadata(teamId);
};

const TeamPage = ({ params }: PageProps<"/teams/[teamId]">) => (
  <div className="page">
    <SectionErrorBoundary title="Team details could not be loaded">
      <Suspense fallback={<TeamDetailSkeleton />}>
        {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
        {params.then(({ teamId }) => (
          <TeamDetail teamId={teamId} />
        ))}
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default TeamPage;
