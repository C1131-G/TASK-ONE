/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import {
  MemberDetail,
  MemberDetailSkeleton,
} from "@/features/people/components/member-detail";
import { parseMemberTab } from "@/features/people/member-tab";

export const metadata: Metadata = { title: "Member profile | Metsys" };
export const instant = false;

const MemberProfilePage = ({
  params,
  searchParams,
}: PageProps<"/members/[employeeId]">) => (
  <Suspense fallback={<MemberDetailSkeleton />}>
    {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
    {Promise.all([params, searchParams]).then(([{ employeeId }, query]) => (
      <MemberDetail
        employeeId={employeeId}
        tab={parseMemberTab(query["tab"])}
      />
    ))}
  </Suspense>
);

export default MemberProfilePage;
