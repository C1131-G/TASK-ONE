/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import { HeaderActionPlaceholder } from "@/components/workspace/header-action-placeholder";
import { SkeletonBone } from "@/components/workspace/skeleton-shapes";
import {
  MembersActions,
  MembersCount,
  MembersSection,
  MembersSectionSkeleton,
} from "@/features/people/components/members-section";
import { parseMembersSection } from "@/features/people/members-section-param";

export const metadata: Metadata = { title: "Members | Metsys" };

const MembersPage = ({ searchParams }: PageProps<"/members">) => (
  <PageTransition>
    <div className="page">
      <div className="ph">
        <div>
          <h1>Members</h1>
          <p>
            <Suspense
              fallback={
                <span aria-hidden="true">
                  <SkeletonBone />
                </span>
              }
            >
              <MembersCount />
            </Suspense>
          </p>
        </div>
        <Suspense fallback={<HeaderActionPlaceholder label="Add employee" />}>
          <MembersActions />
        </Suspense>
      </div>
      <SectionErrorBoundary title="Members couldn't load">
        <SuspenseReveal fallback={<MembersSectionSkeleton />}>
          {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
          {searchParams.then((params) => (
            <MembersSection section={parseMembersSection(params["section"])} />
          ))}
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default MembersPage;
