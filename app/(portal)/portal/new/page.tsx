/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";
import { Suspense } from "react";

import { PortalReport } from "@/features/portal/components/portal-report";
import { PortalListSkeleton } from "@/features/portal/components/portal-skeletons";

export const metadata: Metadata = {
  description: "Report a bug on one of your projects.",
  title: "Report a bug | Metsys",
};

const Page = ({ searchParams }: PageProps<"/portal/new">) => (
  <div className="page portal-narrow">
    <Suspense fallback={<PortalListSkeleton label="Loading bug form" />}>
      {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
      {searchParams.then(({ from }) => (
        <PortalReport from={Array.isArray(from) ? from[0] : from} />
      ))}
    </Suspense>
  </div>
);

export default Page;
