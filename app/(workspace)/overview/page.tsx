/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import {
  WorkspaceOverview,
  WorkspaceOverviewSkeleton,
} from "@/features/dashboard/components/workspace-overview";

export const metadata: Metadata = { title: "Overview | Metsys" };
export const instant = false;

const OverviewPage = () => (
  <div className="page">
    <Suspense fallback={<WorkspaceOverviewSkeleton />}>
      <WorkspaceOverview />
    </Suspense>
  </div>
);

export default OverviewPage;
