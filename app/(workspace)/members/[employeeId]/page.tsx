/* eslint-disable shadcn/no-unknown-classes */

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  MemberHeader,
  MemberHeaderSkeleton,
  MemberWork,
  MemberWorkSkeleton,
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
}: PageProps<"/members/[employeeId]">) => {
  // oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell.
  const route = Promise.all([params, searchParams]).then(
    ([{ employeeId }, query]) => ({
      employeeId,
      tab: parseMemberTab(query["tab"]),
    })
  );
  return (
    <PageTransition>
      <div className="page member-profile-page">
        <Link
          className="member-profile-back"
          href="/members"
          transitionTypes={["nav-back"]}
        >
          <ArrowLeft aria-hidden="true" size={15} />
          All members
        </Link>
        <SectionErrorBoundary title="Member profile could not be loaded">
          <SuspenseReveal fallback={<MemberHeaderSkeleton />}>
            {/* oxlint-disable-next-line promise/prefer-await-to-then -- Route values resolve inside the boundary. */}
            {route.then(({ employeeId }) => (
              <MemberHeader employeeId={employeeId} />
            ))}
          </SuspenseReveal>
        </SectionErrorBoundary>
        <SectionErrorBoundary title="Member work could not be loaded">
          <SuspenseReveal fallback={<MemberWorkSkeleton />}>
            {/* oxlint-disable-next-line promise/prefer-await-to-then -- Route values resolve inside the boundary. */}
            {route.then(({ employeeId, tab }) => (
              <MemberWork employeeId={employeeId} tab={tab} />
            ))}
          </SuspenseReveal>
        </SectionErrorBoundary>
      </div>
    </PageTransition>
  );
};

export default MemberProfilePage;
