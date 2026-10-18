/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { PortalReport } from "@/features/portal/components/portal-report";
import { PortalFormSkeleton } from "@/features/portal/components/portal-skeletons";

export const metadata: Metadata = {
  description: "Report a bug on one of your projects.",
  title: "Report a bug | Metsys",
};

const Page = ({ searchParams }: PageProps<"/portal/new">) => (
  <div className="page portal-narrow">
    <SectionErrorBoundary title="Bug report form could not be loaded">
      <Suspense fallback={<PortalFormSkeleton label="Loading bug form" />}>
        {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
        {searchParams.then(({ from }) => (
          <PortalReport from={Array.isArray(from) ? from[0] : from} />
        ))}
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default Page;
