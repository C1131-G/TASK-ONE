/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";
import { Suspense } from "react";

import { PortalBugList } from "@/features/portal/components/portal-bug-list";
import { PortalListSkeleton } from "@/features/portal/components/portal-skeletons";
import { parsePortalBugFilters } from "@/features/portal/portal-filters";

export const metadata: Metadata = {
  description: "Every bug your company has reported.",
  title: "Company bugs | Metsys",
};

const Page = ({ searchParams }: PageProps<"/portal">) => (
  <div className="page">
    <Suspense fallback={<PortalListSkeleton label="Loading company bugs" />}>
      {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
      {searchParams.then((params) => (
        <PortalBugList filters={parsePortalBugFilters(params)} />
      ))}
    </Suspense>
  </div>
);

export default Page;
