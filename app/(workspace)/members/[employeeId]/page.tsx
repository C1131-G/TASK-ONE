/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import {
  MemberDetail,
  MemberDetailSkeleton,
} from "@/features/people/components/member-detail";
import { memberMetadata } from "@/features/people/member-metadata";
import { parseMemberTab } from "@/features/people/member-tab";

export const generateMetadata = async ({
  params,
}: PageProps<"/members/[employeeId]">): Promise<Metadata> => {
  const { employeeId } = await params;
  return await memberMetadata(employeeId);
};

const MemberProfilePage = ({
  params,
  searchParams,
}: PageProps<"/members/[employeeId]">) => (
  <SectionErrorBoundary title="Member profile could not be loaded">
    <Suspense fallback={<MemberDetailSkeleton />}>
      {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
      {Promise.all([params, searchParams]).then(([{ employeeId }, query]) => (
        <MemberDetail
          employeeId={employeeId}
          tab={parseMemberTab(query["tab"])}
        />
      ))}
    </Suspense>
  </SectionErrorBoundary>
);

export default MemberProfilePage;
