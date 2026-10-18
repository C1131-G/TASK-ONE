/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import {
  MembersSection,
  MembersSectionSkeleton,
} from "@/features/people/components/members-section";
import { parseMembersSection } from "@/features/people/members-section-param";

export const metadata: Metadata = { title: "Members | Metsys" };

const MembersPage = ({ searchParams }: PageProps<"/members">) => (
  <div className="page">
    <SectionErrorBoundary title="members could not be loaded">
      <Suspense fallback={<MembersSectionSkeleton />}>
        {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
        {searchParams.then((params) => (
          <MembersSection section={parseMembersSection(params["section"])} />
        ))}
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default MembersPage;
