/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import {
  PortalBugList,
  PortalListSkeleton,
} from "@/features/portal/components/portal-bug-list";
import { parsePortalBugFilters } from "@/features/portal/portal-filters";

export const metadata: Metadata = {
  description: "Every bug your company has reported.",
  title: "Company bugs | Metsys",
};

const Page = ({ searchParams }: PageProps<"/portal">) => (
  <div className="page">
    <SectionErrorBoundary title="portal could not be loaded">
      <Suspense fallback={<PortalListSkeleton label="Loading company bugs" />}>
        {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
        {searchParams.then((params) => {
          const as = Array.isArray(params["as"])
            ? params["as"][0]
            : params["as"];
          if (as) {
            // The documented entry URL for "View as client".
            redirect(`/portal/preview?as=${encodeURIComponent(as)}` as Route);
          }
          return <PortalBugList filters={parsePortalBugFilters(params)} />;
        })}
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default Page;
