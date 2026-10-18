/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import {
  PortalBugView,
  PortalBugViewSkeleton,
} from "@/features/portal/components/portal-bug-view";

export const metadata: Metadata = { title: "Bug | Metsys" };

const Page = ({ params }: PageProps<"/portal/bugs/[bugId]">) => (
  <div className="page">
    <SectionErrorBoundary title="Bug details could not be loaded">
      <Suspense fallback={<PortalBugViewSkeleton />}>
        {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
        {params.then(({ bugId }) => (
          <PortalBugView bugId={bugId} />
        ))}
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default Page;
