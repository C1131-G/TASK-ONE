/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";
import { Suspense } from "react";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  PortalBugView,
  PortalBugViewSkeleton,
  PortalResponseNotice,
  PortalResponseNoticeSkeleton,
} from "@/features/portal/components/portal-bug-view";
import { portalBugMetadata } from "@/features/portal/portal-bug-metadata";

export const generateMetadata = async ({
  params,
}: PageProps<"/portal/bugs/[bugId]">): Promise<Metadata> => {
  const { bugId } = await params;
  return await portalBugMetadata(bugId);
};

const Page = ({ params }: PageProps<"/portal/bugs/[bugId]">) => (
  <PageTransition>
    <div className="page">
      <SectionErrorBoundary title="Bug details could not be loaded">
        <SuspenseReveal fallback={<PortalBugViewSkeleton />}>
          {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
          {params.then(({ bugId }) => (
            <PortalBugView
              bugId={bugId}
              responseNotice={
                <SectionErrorBoundary title="Response-time guidance is unavailable">
                  <Suspense fallback={<PortalResponseNoticeSkeleton />}>
                    <PortalResponseNotice bugId={bugId} />
                  </Suspense>
                </SectionErrorBoundary>
              }
            />
          ))}
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default Page;
