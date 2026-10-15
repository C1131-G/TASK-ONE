/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";
import { Suspense } from "react";

import { PortalReport } from "@/features/portal/components/portal-report";
import { PortalListSkeleton } from "@/features/portal/components/portal-skeletons";

export const metadata: Metadata = {
  description: "Report a bug on one of your projects.",
  title: "Report a bug | Metsys",
};

const Page = () => (
  <div className="page portal-narrow">
    <Suspense fallback={<PortalListSkeleton label="Loading bug form" />}>
      <PortalReport />
    </Suspense>
  </div>
);

export default Page;
