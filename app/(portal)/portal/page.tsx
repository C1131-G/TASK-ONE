/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  PortalBugList,
  PortalListSkeleton,
} from "@/features/portal/components/portal-bug-list";
import {
  parsePortalBugFilters,
  parsePortalPreviewTarget,
} from "@/features/portal/portal-filters";

export const metadata: Metadata = {
  description: "Every bug your company has reported.",
  title: "Company bugs | Taskora",
};

const Page = ({ searchParams }: PageProps<"/portal">) => (
  <PageTransition>
    <div className="page">
      <SectionErrorBoundary title="Your portal couldn't load">
        <SuspenseReveal
          fallback={<PortalListSkeleton label="Loading company bugs" />}
        >
          {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
          {searchParams.then((params) => {
            const as = parsePortalPreviewTarget(params);
            if (as) {
              // The documented entry URL for "View as client".
              redirect(`/portal/preview?as=${encodeURIComponent(as)}` as Route);
            }
            return <PortalBugList filters={parsePortalBugFilters(params)} />;
          })}
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default Page;
