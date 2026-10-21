/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  TeamDetail,
  TeamDetailSkeleton,
} from "@/features/people/components/team-detail";
import { teamMetadata } from "@/features/people/team-metadata";

export const generateMetadata = async ({
  params,
}: PageProps<"/teams/[teamId]">): Promise<Metadata> => {
  const { teamId } = await params;
  return await teamMetadata(teamId);
};

const TeamPage = ({ params }: PageProps<"/teams/[teamId]">) => (
  <PageTransition>
    <div className="page">
      <SectionErrorBoundary title="Team details couldn't load">
        <SuspenseReveal fallback={<TeamDetailSkeleton />}>
          {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
          {params.then(({ teamId }) => (
            <TeamDetail teamId={teamId} />
          ))}
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default TeamPage;
